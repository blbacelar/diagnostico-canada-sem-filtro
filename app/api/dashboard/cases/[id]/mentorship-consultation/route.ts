import { z } from "zod";

import { ApiError, handleApiError, json, requireConsultant, writeAudit } from "../../../../../../lib/api";
import { claimCaseForReview } from "../../../../../../lib/case-lock";
import { isMentorshipClient } from "../../../../../../lib/purchase-window";

const caseIdSchema = z.string().uuid();

/**
 * Calendly can later write the same column. Until that integration exists, a
 * consultant records the confirmed one-on-one appointment here.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawCaseId } = await params;
    const caseId = caseIdSchema.parse(rawCaseId);
    const { admin, user } = await requireConsultant(request);
    const diagnosticCase = await claimCaseForReview(admin, caseId, user.id);

    if (["cancelled", "archived", "sent", "sending"].includes(diagnosticCase.status)) {
      throw new ApiError(409, "Este simulador não pode ter uma consulta registrada neste estado.", "CASE_NOT_ACTIVE");
    }
    if (!await isMentorshipClient(admin, diagnosticCase.client_id)) {
      throw new ApiError(409, "Este cliente não possui uma compra aprovada da Mentoria.", "MENTORSHIP_PURCHASE_REQUIRED");
    }
    if (diagnosticCase.mentorship_consultation_scheduled_at) {
      return json({
        scheduledAt: diagnosticCase.mentorship_consultation_scheduled_at,
        alreadyScheduled: true,
      });
    }

    const scheduledAt = new Date().toISOString();
    const { data: updatedCase, error: updateError } = await admin
      .from("diagnostic_cases")
      .update({ mentorship_consultation_scheduled_at: scheduledAt, updated_at: scheduledAt })
      .eq("id", caseId)
      .eq("assigned_consultant_id", user.id)
      .is("mentorship_consultation_scheduled_at", null)
      .select("id,case_number,mentorship_consultation_scheduled_at")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedCase) {
      throw new ApiError(409, "A consulta já foi atualizada por outra pessoa. Atualize a página e tente novamente.", "MENTORSHIP_CONSULTATION_CONFLICT");
    }

    const historyResult = await admin.from("diagnostic_status_history").insert({
      case_id: caseId,
      from_status: diagnosticCase.status,
      to_status: diagnosticCase.status,
      actor_type: "consultant",
      actor_user_id: user.id,
      note: "Consulta one-on-one da Mentoria marcada. A entrega do Simulador foi liberada.",
    });
    if (historyResult.error) throw historyResult.error;
    await writeAudit(admin, {
      caseId,
      actorUserId: user.id,
      actorType: "consultant",
      action: "mentorship.consultation_marked",
      metadata: { scheduledAt },
    });

    return json({ scheduledAt: updatedCase.mentorship_consultation_scheduled_at });
  } catch (error) {
    return handleApiError(error);
  }
}
