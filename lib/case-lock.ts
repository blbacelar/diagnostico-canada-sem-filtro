import { ApiError, writeAudit } from "./api";
import { getAdminSupabase } from "./supabase";

type AdminClient = ReturnType<typeof getAdminSupabase>;

export type LockableCase = {
  id: string;
  status: string;
  assigned_consultant_id: string | null;
};

const lockedStatuses = new Set([
  "submitted",
  "ai_processing",
  "awaiting_triage",
  "in_review",
  "awaiting_client",
  "ready_for_approval",
  "approved",
  "sending",
  "processing_error",
]);

const statusesThatStartReview = new Set(["submitted", "awaiting_triage", "processing_error"]);

export function isCaseLockActive(status: string) {
  return lockedStatuses.has(status);
}

async function readCase(admin: AdminClient, caseId: string) {
  const { data, error } = await admin
    .from("diagnostic_cases")
    .select("id,case_number,status,objective,submitted_at,updated_at,assigned_consultant_id,client_id")
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Diagnóstico não encontrado.");
  return data;
}

async function lockedCaseError(admin: AdminClient, consultantId: string) {
  const { data } = await admin
    .from("diagnostic_consultants")
    .select("display_name")
    .eq("user_id", consultantId)
    .maybeSingle();
  const owner = data?.display_name ?? "outra consultora";
  return new ApiError(423, `Este diagnóstico já está em revisão por ${owner}.`, "CASE_LOCKED");
}

export async function claimCaseForReview(admin: AdminClient, caseId: string, consultantId: string) {
  const current = await readCase(admin, caseId);
  if (!isCaseLockActive(current.status)) return current;
  if (current.assigned_consultant_id === consultantId) return current;
  if (current.assigned_consultant_id) throw await lockedCaseError(admin, current.assigned_consultant_id);

  const nextStatus = statusesThatStartReview.has(current.status) ? "in_review" : current.status;
  const { data: claimed, error } = await admin
    .from("diagnostic_cases")
    .update({ assigned_consultant_id: consultantId, status: nextStatus })
    .eq("id", caseId)
    .eq("status", current.status)
    .is("assigned_consultant_id", null)
    .select("id,case_number,status,objective,submitted_at,updated_at,assigned_consultant_id,client_id")
    .maybeSingle();
  if (error) throw error;

  if (!claimed) {
    const latest = await readCase(admin, caseId);
    if (latest.assigned_consultant_id === consultantId || !isCaseLockActive(latest.status)) return latest;
    if (latest.assigned_consultant_id) throw await lockedCaseError(admin, latest.assigned_consultant_id);
    throw new ApiError(409, "O diagnóstico foi atualizado por outra pessoa. Atualize a lista e tente novamente.", "CASE_LOCK_CONFLICT");
  }

  if (nextStatus !== current.status) {
    await admin.from("diagnostic_status_history").insert({
      case_id: caseId,
      from_status: current.status,
      to_status: nextStatus,
      actor_type: "consultant",
      actor_user_id: consultantId,
      note: "Revisão iniciada e caso reservado para a consultora responsável.",
    });
  }
  await writeAudit(admin, {
    caseId,
    actorUserId: consultantId,
    actorType: "consultant",
    action: "diagnostic.claimed",
    metadata: { previousStatus: current.status, status: nextStatus },
  });
  return claimed;
}

export async function decorateCaseLocks<T extends LockableCase>(admin: AdminClient, cases: T[], consultantId: string) {
  const ownerIds = [...new Set(cases
    .filter((item) => isCaseLockActive(item.status) && item.assigned_consultant_id && item.assigned_consultant_id !== consultantId)
    .map((item) => item.assigned_consultant_id as string))];
  const ownerNames = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data, error } = await admin.from("diagnostic_consultants").select("user_id,display_name").in("user_id", ownerIds);
    if (error) throw error;
    for (const owner of data ?? []) ownerNames.set(owner.user_id, owner.display_name);
  }

  return cases.map((item) => {
    const lockedByOther = Boolean(isCaseLockActive(item.status) && item.assigned_consultant_id && item.assigned_consultant_id !== consultantId);
    return {
      ...item,
      locked_by_other: lockedByOther,
      locked_by_name: lockedByOther && item.assigned_consultant_id
        ? ownerNames.get(item.assigned_consultant_id) ?? "Outra consultora"
        : null,
    };
  });
}
