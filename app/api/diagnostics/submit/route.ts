import { waitUntil } from "@vercel/functions";
import { submitPayloadSchema } from "../../../../lib/schemas";
import {
  ApiError,
  enforceRateLimit,
  getIdempotencyKey,
  handleApiError,
  hasDatabaseErrorCode,
  json,
  parseJson,
  requireFormCase,
  writeAudit,
} from "../../../../lib/api";
import { diagnosticSections, missingRequiredQuestions, normalizeDiagnosticAnswers } from "../../../../lib/questions";
import { processAssessment } from "../../../../lib/cases";
import { sendSubmissionConfirmation } from "../../../../lib/email";
import { getOperationalConfig } from "../../../../lib/operational-config.server";
import { diagnosticSubmissionAnswersSchema } from "../../../../lib/diagnostic-validation";
import { notifyDashboardUsersOfSubmission } from "../../../../lib/dashboard-notifications";

const expectedTime = "até 5 dias úteis";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "diagnostic_submit", 5, 60);
    const payload = await parseJson(request, submitPayloadSchema, 20_000);
    const { admin, caseRow } = await requireFormCase(request);
    const operationalConfig = await getOperationalConfig(admin);
    const idempotencyKey = getIdempotencyKey(request, payload.idempotencyKey);

    const { data: existing } = await admin
      .from("diagnostic_submissions")
      .select("id,submitted_at")
      .eq("case_id", caseRow.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) return json({ caseNumber: caseRow.case_number, submittedAt: existing.submitted_at, expectedTime });
    if (caseRow.status !== "client_draft") throw new ApiError(409, "Este diagnóstico já foi enviado.", "ALREADY_SUBMITTED");

    const { data: rows, error } = await admin.from("diagnostic_answers").select("question_key,answer").eq("case_id", caseRow.id);
    if (error) throw error;
    const answers = normalizeDiagnosticAnswers(
      Object.fromEntries((rows ?? []).map((row) => [row.question_key, row.answer])),
    );
    const missing = diagnosticSections.flatMap((section) => missingRequiredQuestions(section, answers));
    if (missing.length) throw new ApiError(422, `Existem ${missing.length} respostas obrigatórias pendentes.`, "INCOMPLETE_FORM");
    diagnosticSubmissionAnswersSchema.parse(answers);

    const now = new Date().toISOString();
    const sourceMetadata = caseRow.source_metadata && typeof caseRow.source_metadata === "object" ? caseRow.source_metadata as Record<string, unknown> : {};
    const consultantId = sourceMetadata.source === "consultant_reassessment" && typeof sourceMetadata.created_by_consultant_id === "string" ? sourceMetadata.created_by_consultant_id : null;
    const submissionActor = consultantId ? "consultant" : "client";

    const { error: disclaimerConsentError } = await admin.from("diagnostic_consents").insert({
      case_id: caseRow.id,
      consent_type: "legal_disclaimer_acknowledgment",
      policy_version: payload.policyVersion,
      granted: payload.legalDisclaimerAccepted,
      source: consultantId ? "consultant_reassessment" : "form_submission",
    });
    if (disclaimerConsentError) throw disclaimerConsentError;

    const { data: submission, error: submissionError } = await admin
      .from("diagnostic_submissions")
      .insert({
        case_id: caseRow.id,
        answers_snapshot: answers,
        schema_version: 1,
        consent_snapshot: {
          granted: true,
          policyVersion: payload.policyVersion,
          submittedAt: now,
          submittedBy: submissionActor,
          legalDisclaimerAccepted: payload.legalDisclaimerAccepted,
          legalDisclaimerAcceptedAt: now,
        },
        idempotency_key: idempotencyKey,
        submitted_at: now,
      })
      .select("id")
      .single();

    if (submissionError) {
      if (!hasDatabaseErrorCode(submissionError, "23505")) throw submissionError;
      const { data: conflictingSubmission, error: conflictReadError } = await admin
        .from("diagnostic_submissions")
        .select("idempotency_key,submitted_at")
        .eq("case_id", caseRow.id)
        .order("submitted_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (conflictReadError) throw conflictReadError;
      if (conflictingSubmission?.idempotency_key === idempotencyKey) {
        return json({ caseNumber: caseRow.case_number, submittedAt: conflictingSubmission.submitted_at, expectedTime });
      }
      throw new ApiError(409, "Este diagnóstico já foi enviado.", "ALREADY_SUBMITTED");
    }

    const { data: previous } = await admin
      .from("diagnostic_ai_assessments")
      .select("version")
      .eq("case_id", caseRow.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: assessment, error: assessmentError } = await admin
      .from("diagnostic_ai_assessments")
      .insert({
        case_id: caseRow.id,
        submission_id: submission.id,
        version: (previous?.version ?? 0) + 1,
        status: "processing",
        methodology_version: operationalConfig.methodologyVersion,
        prompt_version: operationalConfig.promptVersion,
        model: operationalConfig.model,
        structured_result: {},
      })
      .select("id")
      .single();
    if (assessmentError) throw assessmentError;

    await admin.from("diagnostic_cases").update({ status: "ai_processing", submitted_at: now, objective: String(answers.main_objective ?? "").trim() || null }).eq("id", caseRow.id);
    await admin.from("diagnostic_access_tokens").update({ revoked_at: now }).eq("case_id", caseRow.id).is("revoked_at", null);
    await admin.from("diagnostic_status_history").insert([
      { case_id: caseRow.id, from_status: "client_draft", to_status: "submitted", actor_type: submissionActor, actor_user_id: consultantId, note: consultantId ? "Snapshot imutável criado pela consultoria após atualização das informações." : "Snapshot imutável criado." },
      { case_id: caseRow.id, from_status: "submitted", to_status: "ai_processing", actor_type: "system", note: "Análise estruturada iniciada." },
    ]);

    const { data: client } = await admin
      .from("diagnostic_clients")
      .select("full_name,email_normalized")
      .eq("id", caseRow.client_id)
      .single();
    if (client) {
      waitUntil(sendSubmissionConfirmation({
        to: client.email_normalized,
        fullName: client.full_name,
        caseNumber: caseRow.case_number,
      }).then(async (result) => {
        await admin.from("diagnostic_email_deliveries").insert({
          case_id: caseRow.id,
          delivery_type: "submission_confirmation",
          recipient: client.email_normalized,
          subject: `Recebemos o diagnóstico ${caseRow.case_number}`,
          status: result.error ? "failed" : "sent",
          provider_id: result.data?.id ?? null,
          error_code: result.error?.name ?? null,
          sent_at: result.error ? null : new Date().toISOString(),
        });
      }));
    }

    waitUntil(notifyDashboardUsersOfSubmission(admin, {
      caseId: caseRow.id,
      caseNumber: caseRow.case_number,
      clientName: client?.full_name ?? "Cliente",
    }).catch((notificationError) => {
      console.error("dashboard_submission_notification_failed", {
        caseId: caseRow.id,
        error: notificationError instanceof Error ? notificationError.name : "UNKNOWN_ERROR",
      });
    }));

    waitUntil(processAssessment(caseRow.id, submission.id, assessment.id));
    await writeAudit(admin, {
      caseId: caseRow.id,
      actorUserId: consultantId,
      actorType: submissionActor,
      action: "diagnostic.submitted",
      metadata: { submissionId: submission.id, schemaVersion: 1, legalDisclaimerAccepted: payload.legalDisclaimerAccepted },
    });
    const response = json({ caseNumber: caseRow.case_number, submittedAt: now, expectedTime }, { status: 202 });
    response.headers.append("Set-Cookie", "diagnostic_form_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
