import { randomInt } from "node:crypto";
import { getAdminSupabase } from "./supabase";
import { generateAssessment } from "./ai";
import { ApiError, writeAudit } from "./api";
import { legacyClientShape } from "./central-client";

export function newCaseNumber() {
  return `CSF-${new Date().getFullYear()}-${randomInt(0, 36 ** 6).toString(36).toUpperCase().padStart(6, "0")}`;
}

export async function processAssessment(caseId: string, submissionId: string, assessmentId: string) {
  const admin = getAdminSupabase();
  try {
    const [submissionResult, assessmentConfigResult] = await Promise.all([
      admin.from("diagnostic_submissions").select("answers_snapshot").eq("id", submissionId).eq("case_id", caseId).single(),
      admin.from("diagnostic_ai_assessments").select("methodology_version,prompt_version,model").eq("id", assessmentId).eq("case_id", caseId).single(),
    ]);
    if (submissionResult.error) throw submissionResult.error;
    if (assessmentConfigResult.error) throw assessmentConfigResult.error;
    const config = {
      methodologyVersion: assessmentConfigResult.data.methodology_version,
      promptVersion: assessmentConfigResult.data.prompt_version,
      model: assessmentConfigResult.data.model,
    };
    const assessment = await generateAssessment(submissionResult.data.answers_snapshot, config);
    const { error: assessmentError } = await admin.from("diagnostic_ai_assessments").update({ status: "completed", structured_result: assessment, confidence: assessment.confidence, model: assessment.model, completed_at: new Date().toISOString(), error_code: null }).eq("id", assessmentId).eq("case_id", caseId);
    if (assessmentError) throw assessmentError;
    await admin.from("diagnostic_cases").update({ status: "awaiting_triage" }).eq("id", caseId);
    await admin.from("diagnostic_status_history").insert({ case_id: caseId, from_status: "ai_processing", to_status: "awaiting_triage", actor_type: "system", note: "Análise estruturada concluída." });
    await writeAudit(admin, { caseId, actorType: "system", action: "ai_assessment.completed", metadata: { assessmentId, methodologyVersion: config.methodologyVersion, promptVersion: config.promptVersion, model: config.model } });
  } catch (error) {
    const code = error instanceof Error ? error.name.slice(0, 80) : "UNKNOWN_AI_ERROR";
    await admin.from("diagnostic_ai_assessments").update({ status: "failed", error_code: code, completed_at: new Date().toISOString() }).eq("id", assessmentId);
    await admin.from("diagnostic_cases").update({ status: "processing_error" }).eq("id", caseId);
    await admin.from("diagnostic_status_history").insert({ case_id: caseId, from_status: "ai_processing", to_status: "processing_error", actor_type: "system", note: "Falha segura no processamento; respostas preservadas." });
    await writeAudit(admin, { caseId, actorType: "system", action: "ai_assessment.failed", metadata: { assessmentId, errorCode: code } });
    throw error;
  }
}

export async function caseClient(admin: ReturnType<typeof getAdminSupabase>, caseId: string) {
  const { data, error } = await admin.from("diagnostic_cases").select("id, case_number, status, client_id, clients!inner(id,name,email,created_at,updated_at)").eq("id", caseId).single();
  if (error) throw error;
  const centralClient = Array.isArray(data.clients) ? data.clients[0] : data.clients;
  const client = legacyClientShape(centralClient);
  if (!client) throw new ApiError(404, "Cliente não encontrado.", "CLIENT_NOT_FOUND");
  return { case: data, client };
}
