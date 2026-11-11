import { z } from "zod";

import { ApiError, enforceRateLimit, handleApiError, json, parseJson, requireConsultant } from "../../../../lib/api";
import { processAssessment } from "../../../../lib/cases";
import { claimCaseForReview } from "../../../../lib/case-lock";
import { getAdminSupabase } from "../../../../lib/supabase";
import { constantTimeEqual } from "../../../../lib/tokens";

const schema = z.object({ caseId: z.string().uuid(), assessmentId: z.string().uuid().optional() });

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "diagnostic_process_ai", 20, 15);
    const payload = await parseJson(request, schema, 10_000);
    let admin;
    let consultantId: string | null = null;
    const secret = request.headers.get("x-cron-secret");

    if (secret && process.env.CRON_SECRET && constantTimeEqual(secret, process.env.CRON_SECRET)) {
      admin = getAdminSupabase();
    } else {
      const consultant = await requireConsultant(request);
      admin = consultant.admin;
      consultantId = consultant.user.id;
      await claimCaseForReview(admin, payload.caseId, consultantId);
    }

    const { data: currentCase, error: caseError } = await admin
      .from("diagnostic_cases")
      .select("status")
      .eq("id", payload.caseId)
      .maybeSingle();
    if (caseError) throw caseError;
    if (!currentCase) throw new ApiError(404, "Simulador não encontrado.", "CASE_NOT_FOUND");
    if (currentCase.status === "cancelled") {
      throw new ApiError(409, "Este simulador foi cancelado e não pode ser processado.", "CASE_CANCELLED");
    }

    const { data: assessment, error } = await admin
      .from("diagnostic_ai_assessments")
      .select("id,submission_id,status")
      .eq("case_id", payload.caseId)
      .eq(payload.assessmentId ? "id" : "status", payload.assessmentId ?? "failed")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!assessment) throw new ApiError(404, "Análise não encontrada.");
    if (assessment.status === "completed") return json({ status: "completed" });

    await admin
      .from("diagnostic_ai_assessments")
      .update({ status: "processing", error_code: null, completed_at: null })
      .eq("id", assessment.id);

    let caseUpdate = admin
      .from("diagnostic_cases")
      .update({ status: "ai_processing" })
      .eq("id", payload.caseId)
      .neq("status", "cancelled");
    if (consultantId) caseUpdate = caseUpdate.eq("assigned_consultant_id", consultantId);
    const { data: processingCase, error: processingError } = await caseUpdate.select("id").maybeSingle();
    if (processingError) throw processingError;
    if (!processingCase) {
      throw new ApiError(409, "O simulador foi cancelado ou atualizado antes do processamento.", "PROCESSING_NOT_AVAILABLE");
    }

    await processAssessment(payload.caseId, assessment.submission_id, assessment.id);
    return json({ status: "completed" });
  } catch (error) {
    return handleApiError(error);
  }
}
