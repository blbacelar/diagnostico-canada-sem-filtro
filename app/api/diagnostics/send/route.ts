import { sendDiagnosticSchema } from "../../../../lib/schemas";
import { ApiError, enforceRateLimit, getIdempotencyKey, handleApiError, json, parseJson, requireConsultant, writeAudit } from "../../../../lib/api";
import { caseClient } from "../../../../lib/cases";
import { createFormToken, hashFormToken } from "../../../../lib/tokens";
import { generateReportPdf, getReportData } from "../../../../lib/report";
import { sendFinalDiagnosticWithPdf } from "../../../../lib/email";
import { getOperationalConfig } from "../../../../lib/operational-config.server";
import { claimCaseForReview } from "../../../../lib/case-lock";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "diagnostic_send_final", 20, 15);
    const payload = await parseJson(request, sendDiagnosticSchema, 40_000);
    const { admin, user } = await requireConsultant(request);
    const key = getIdempotencyKey(request, payload.idempotencyKey);
    const { data: existing } = await admin.from("diagnostic_email_deliveries").select("id,status,provider_id").eq("idempotency_key", key).maybeSingle();
    if (existing) return json({ delivery: existing });
    const diagnosticCase = await claimCaseForReview(admin, payload.caseId, user.id);
    const { data: requestedReview } = await admin
      .from("diagnostic_reviews")
      .select("id,status")
      .eq("id", payload.reviewId)
      .eq("case_id", payload.caseId)
      .maybeSingle();
    const effectiveReview = requestedReview?.status === "approved"
      ? requestedReview
      : (await admin
          .from("diagnostic_reviews")
          .select("id,status")
          .eq("case_id", payload.caseId)
          .eq("status", "approved")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle()).data;
    if (!effectiveReview || effectiveReview.status !== "approved") {
      throw new ApiError(409, "A entrega exige um parecer aprovado.", "APPROVAL_REQUIRED");
    }

    let caseStatus = diagnosticCase.status;
    if (caseStatus === "sent") {
      throw new ApiError(409, "Este diagnóstico já foi enviado.", "ALREADY_DELIVERED");
    }
    if (caseStatus !== "approved") {
      const { data: syncedCase } = await admin
        .from("diagnostic_cases")
        .update({ status: "approved" })
        .eq("id", payload.caseId)
        .eq("assigned_consultant_id", user.id)
        .select("status")
        .maybeSingle();
      caseStatus = syncedCase?.status ?? caseStatus;
    }
    if (caseStatus !== "approved") {
      throw new ApiError(409, "O diagnóstico não está pronto para entrega.", "DELIVERY_NOT_READY");
    }

    const [target, config] = await Promise.all([caseClient(admin, payload.caseId), getOperationalConfig(admin)]);
    const reportToken = createFormToken();
    await admin.from("diagnostic_report_tokens").insert({ case_id: payload.caseId, review_id: effectiveReview.id, token_hash: hashFormToken(reportToken), expires_at: new Date(Date.now() + config.reportLinkDays * 24 * 60 * 60 * 1000).toISOString() });
    const reportUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/relatorio/${encodeURIComponent(reportToken)}`;
    await admin.from("diagnostic_cases").update({ status: "sending" }).eq("id", payload.caseId).eq("assigned_consultant_id", user.id);
    let pdf: Uint8Array | undefined;
    if (payload.deliveryMethod === "pdf") pdf = await generateReportPdf(await getReportData(admin, payload.caseId));
    const result = await sendFinalDiagnosticWithPdf({ to: target.client.email_normalized, subject: payload.subject, body: payload.body, reportUrl, pdf, caseNumber: target.case.case_number });
    const status = result.error ? "failed" : "sent";
    const { data: delivery, error } = await admin.from("diagnostic_email_deliveries").insert({ case_id: payload.caseId, delivery_type: "final_diagnostic", recipient: target.client.email_normalized, subject: payload.subject, body_snapshot: payload.body, status, provider_id: result.data?.id ?? null, error_code: result.error?.name ?? null, sent_at: result.error ? null : new Date().toISOString(), sent_by: user.id, idempotency_key: key, metadata: { deliveryMethod: payload.deliveryMethod, reportTokenId: "stored", reportLinkDays: config.reportLinkDays } }).select("id,status,provider_id").single();
    if (error) throw error;
    const nextStatus = result.error ? "approved" : "sent";
    await admin.from("diagnostic_cases").update({ status: nextStatus }).eq("id", payload.caseId).eq("assigned_consultant_id", user.id);
    await admin.from("diagnostic_status_history").insert({ case_id: payload.caseId, from_status: "sending", to_status: nextStatus, actor_type: "consultant", actor_user_id: user.id, note: result.error ? "Falha no envio; parecer aprovado preservado." : "Diagnóstico final enviado." });
    await writeAudit(admin, { caseId: payload.caseId, actorUserId: user.id, actorType: "consultant", action: "diagnostic.delivery", metadata: { deliveryId: delivery.id, status, deliveryMethod: payload.deliveryMethod, reportLinkDays: config.reportLinkDays } });
    return json({ delivery }, { status: result.error ? 502 : 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
