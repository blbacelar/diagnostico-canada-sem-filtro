import { ApiError, handleApiError, json, requireFormCase } from "../../../../lib/api";
import { operationalConfig } from "../../../../lib/operational-config";
import { normalizeDiagnosticAnswers } from "../../../../lib/questions";
import { tokenCookie } from "../../../../lib/tokens";

export async function GET(request: Request) {
  try {
    const { admin, token, caseRow } = await requireFormCase(request);
    const [clientResult, answersResult, consentResult] = await Promise.all([
      admin.from("diagnostic_clients").select("full_name").eq("id", caseRow.client_id).single(),
      admin.from("diagnostic_answers").select("question_key,answer").eq("case_id", caseRow.id),
      admin.from("diagnostic_consents").select("policy_version").eq("case_id", caseRow.id).eq("granted", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    for (const result of [clientResult, answersResult, consentResult]) if (result.error) throw result.error;
    if (!clientResult.data) throw new ApiError(404, "Cliente não encontrado.", "CLIENT_NOT_FOUND");
    const answers = normalizeDiagnosticAnswers(
      Object.fromEntries((answersResult.data ?? []).map((row) => [row.question_key, row.answer])),
    );
    const sourceMetadata = caseRow.source_metadata && typeof caseRow.source_metadata === "object" ? caseRow.source_metadata as Record<string, unknown> : {};
    const response = json({
      caseId: caseRow.id,
      caseNumber: caseRow.case_number,
      status: caseRow.status,
      submittedAt: caseRow.submitted_at,
      client: { fullName: clientResult.data.full_name },
      answers,
      policyVersion: consentResult.data?.policy_version ?? operationalConfig.policyVersion,
      consultantManaged: sourceMetadata.source === "consultant_reassessment",
    });
    response.headers.append("Set-Cookie", tokenCookie(token));
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
