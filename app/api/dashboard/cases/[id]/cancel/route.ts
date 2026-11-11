import { z } from "zod";

import { ApiError, handleApiError, json, requireConsultant, writeAudit } from "../../../../../../lib/api";

const caseIdSchema = z.string().uuid();
const cancellableStatuses = [
  "client_draft",
  "submitted",
  "ai_processing",
  "awaiting_triage",
  "in_review",
  "awaiting_client",
  "ready_for_approval",
  "approved",
  "processing_error",
] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawCaseId } = await params;
    const caseId = caseIdSchema.parse(rawCaseId);
    const { admin, user } = await requireConsultant(request);

    const { data: currentCase, error: readError } = await admin
      .from("diagnostic_cases")
      .select("id,case_number,status")
      .eq("id", caseId)
      .maybeSingle();
    if (readError) throw readError;
    if (!currentCase) throw new ApiError(404, "Simulador não encontrado.", "CASE_NOT_FOUND");

    if (currentCase.status === "cancelled") {
      return json({ case: currentCase, alreadyCancelled: true });
    }
    if (currentCase.status === "sent") {
      throw new ApiError(409, "Este simulador já foi enviado e não pode ser cancelado.", "CASE_ALREADY_DELIVERED");
    }
    if (currentCase.status === "sending") {
      throw new ApiError(409, "O envio já está em andamento. Aguarde a conclusão antes de tomar outra ação.", "CASE_DELIVERY_IN_PROGRESS");
    }
    if (currentCase.status === "archived") {
      throw new ApiError(409, "Este simulador está arquivado e não pode ser cancelado.", "CASE_ARCHIVED");
    }

    const cancelledAt = new Date().toISOString();
    const { data: cancelledCase, error: cancelError } = await admin
      .from("diagnostic_cases")
      .update({
        status: "cancelled",
        assigned_consultant_id: null,
        locked_at: null,
        lock_expires_at: null,
        updated_at: cancelledAt,
      })
      .eq("id", caseId)
      .in("status", [...cancellableStatuses])
      .select("id,case_number,status,objective,submitted_at,updated_at,assigned_consultant_id")
      .maybeSingle();
    if (cancelError) throw cancelError;

    if (!cancelledCase) {
      const { data: latestCase, error: latestError } = await admin
        .from("diagnostic_cases")
        .select("id,case_number,status")
        .eq("id", caseId)
        .maybeSingle();
      if (latestError) throw latestError;
      if (latestCase?.status === "cancelled") return json({ case: latestCase, alreadyCancelled: true });
      throw new ApiError(409, "O simulador foi atualizado por outra pessoa. Atualize a página e tente novamente.", "CASE_CANCEL_CONFLICT");
    }

    const [accessTokensRevocation, reportTokensRevocation, historyWrite] = await Promise.all([
      admin.from("diagnostic_access_tokens").update({ revoked_at: cancelledAt }).eq("case_id", caseId).is("revoked_at", null),
      admin.from("diagnostic_report_tokens").update({ revoked_at: cancelledAt }).eq("case_id", caseId).is("revoked_at", null),
      admin.from("diagnostic_status_history").insert({
        case_id: caseId,
        from_status: currentCase.status,
        to_status: "cancelled",
        actor_type: "consultant",
        actor_user_id: user.id,
        note: "Simulador cancelado pela consultoria. A entrega foi interrompida e os links de acesso foram revogados.",
      }),
    ]);
    if (accessTokensRevocation.error) throw accessTokensRevocation.error;
    if (reportTokensRevocation.error) throw reportTokensRevocation.error;
    if (historyWrite.error) throw historyWrite.error;
    await writeAudit(admin, {
      caseId,
      actorUserId: user.id,
      actorType: "consultant",
      action: "diagnostic.cancelled",
      metadata: { previousStatus: currentCase.status, caseNumber: currentCase.case_number },
    });

    return json({ case: cancelledCase, cancelledAt });
  } catch (error) {
    return handleApiError(error);
  }
}
