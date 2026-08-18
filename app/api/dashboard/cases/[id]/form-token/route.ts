import { z } from "zod";
import { ApiError, handleApiError, json, requireConsultant } from "../../../../../../lib/api";
import { getOperationalConfig } from "../../../../../../lib/operational-config.server";
import { createFormToken, hashFormToken } from "../../../../../../lib/tokens";

const caseIdSchema = z.string().uuid();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawCaseId } = await params;
    const caseId = caseIdSchema.parse(rawCaseId);
    const { admin, user } = await requireConsultant(request);

    const { data: diagnosticCase, error: caseError } = await admin
      .from("diagnostic_cases")
      .select("id,case_number,status,source_metadata")
      .eq("id", caseId)
      .is("archived_at", null)
      .maybeSingle();

    if (caseError) throw caseError;
    if (!diagnosticCase) throw new ApiError(404, "Simulador não encontrado.", "CASE_NOT_FOUND");

    const now = new Date().toISOString();

    if (["sending"].includes(diagnosticCase.status)) {
      throw new ApiError(
        409,
        "Um simulador em processo de envio não pode ser alterado.",
        "CASE_IMMUTABLE",
      );
    }

    if (["approved", "sent"].includes(diagnosticCase.status)) {
      await admin
        .from("diagnostic_cases")
        .update({ status: "in_review", updated_at: now })
        .eq("id", caseId);

      await admin.from("diagnostic_status_history").insert({
        case_id: caseId,
        from_status: diagnosticCase.status,
        to_status: "in_review",
        actor_type: "consultant",
        actor_user_id: user.id,
        note: "Status reaberto para in_review ao iniciar edição das respostas pela consultoria.",
      });
    }

    const config = await getOperationalConfig(admin);
    const sourceMetadata =
      diagnosticCase.source_metadata && typeof diagnosticCase.source_metadata === "object"
        ? (diagnosticCase.source_metadata as Record<string, unknown>)
        : {};

    const updatedMetadata = {
      ...sourceMetadata,
      consultant_managed: true,
      last_edited_by_consultant_id: user.id,
    };

    await admin
      .from("diagnostic_cases")
      .update({ source_metadata: updatedMetadata })
      .eq("id", caseId);

    const token = createFormToken();
    const expiresAt = new Date(Date.now() + config.formLinkDays * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("diagnostic_access_tokens").update({ revoked_at: now }).eq("case_id", caseId).is("revoked_at", null);
    await admin.from("diagnostic_access_tokens").insert({
      case_id: caseId,
      token_hash: hashFormToken(token),
      expires_at: expiresAt,
    });

    return json({
      caseId: diagnosticCase.id,
      caseNumber: diagnosticCase.case_number,
      editUrl: `/formulario?token=${encodeURIComponent(token)}&origem=dashboard`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
