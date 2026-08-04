import { z } from "zod";
import { ApiError, handleApiError, hasDatabaseErrorCode, json, requireConsultant } from "../../../../../../lib/api";
import { newCaseNumber } from "../../../../../../lib/cases";
import { getOperationalConfig } from "../../../../../../lib/operational-config.server";
import { createFormToken, hashFormToken } from "../../../../../../lib/tokens";

const caseIdSchema = z.string().uuid();

type ReassessmentRow = { id: string; case_number: string };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawCaseId } = await params;
    const caseId = caseIdSchema.parse(rawCaseId);
    const { admin, user } = await requireConsultant(request);
    const { data: sourceCase, error: sourceError } = await admin
      .from("diagnostic_cases")
      .select("id,status")
      .eq("id", caseId)
      .is("archived_at", null)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!sourceCase) throw new ApiError(404, "Diagnóstico não encontrado.", "CASE_NOT_FOUND");
    if (sourceCase.status !== "sent") {
      throw new ApiError(409, "O novo diagnóstico só pode ser criado depois que a entrega anterior foi enviada.", "CASE_NOT_DELIVERED");
    }

    const config = await getOperationalConfig(admin);
    const token = createFormToken();
    const { data, error } = await admin.rpc("create_diagnostic_reassessment", {
      p_source_case_id: caseId,
      p_consultant_id: user.id,
      p_case_number: newCaseNumber(),
      p_token_hash: hashFormToken(token),
      p_token_expires_at: new Date(Date.now() + config.formLinkDays * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) {
      if (hasDatabaseErrorCode(error, "23505")) {
        throw new ApiError(409, "Já existe um diagnóstico em andamento para este cliente.", "ACTIVE_DIAGNOSTIC_EXISTS");
      }
      if (hasDatabaseErrorCode(error, "P0002")) {
        throw new ApiError(409, error.message, "SOURCE_ANSWERS_UNAVAILABLE");
      }
      throw error;
    }
    const created = (data as ReassessmentRow[] | null)?.[0];
    if (!created) throw new ApiError(500, "O novo diagnóstico não pôde ser aberto.", "REASSESSMENT_NOT_CREATED");

    return json({
      caseId: created.id,
      caseNumber: created.case_number,
      editUrl: `/formulario?token=${encodeURIComponent(token)}&origem=dashboard`,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
