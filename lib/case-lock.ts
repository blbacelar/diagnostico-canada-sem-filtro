import { ApiError, writeAudit } from "./api";
import { getAdminSupabase } from "./supabase";

type AdminClient = ReturnType<typeof getAdminSupabase>;

export type LockableCase = {
  id: string;
  case_number?: string;
  status: string;
  objective?: string | null;
  submitted_at?: string | null;
  updated_at?: string;
  assigned_consultant_id: string | null;
  client_id?: string;
  locked_at?: string | null;
  lock_expires_at?: string | null;
};

const lockTtlMs = 5 * 60 * 1000;

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
const baseCaseSelect = "id,case_number,status,objective,submitted_at,updated_at,assigned_consultant_id,client_id";
const lockAwareCaseSelect = `${baseCaseSelect},locked_at,lock_expires_at`;

export function isCaseLockActive(status: string) {
  return lockedStatuses.has(status);
}

function isMissingLockColumn(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && error.code === "42703" && /locked_at|lock_expires_at/i.test(error.message ?? ""));
}

async function readCase(admin: AdminClient, caseId: string) {
  const { data, error } = await admin
    .from("diagnostic_cases")
    .select(lockAwareCaseSelect)
    .eq("id", caseId)
    .maybeSingle();
  if (isMissingLockColumn(error)) {
    const { data: fallbackData, error: fallbackError } = await admin
      .from("diagnostic_cases")
      .select(baseCaseSelect)
      .eq("id", caseId)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    if (!fallbackData) throw new ApiError(404, "Simulador não encontrado.");
    return { ...fallbackData, locked_at: null, lock_expires_at: null };
  }
  if (error) throw error;
  if (!data) throw new ApiError(404, "Simulador não encontrado.");
  return data;
}

async function lockedCaseError(admin: AdminClient, consultantId: string) {
  const { data } = await admin
    .from("diagnostic_consultants")
    .select("display_name")
    .eq("user_id", consultantId)
    .maybeSingle();
  const owner = data?.display_name ?? "outra consultora";
  return new ApiError(423, `Este simulador já está em revisão por ${owner}.`, "CASE_LOCKED");
}

function lockExpirationFrom(now: Date) {
  return new Date(now.getTime() + lockTtlMs).toISOString();
}

function isAssignedLockExpired(current: LockableCase, now = new Date()) {
  if (!current.assigned_consultant_id) return false;
  if (!current.lock_expires_at) return true;
  return new Date(current.lock_expires_at).getTime() <= now.getTime();
}

async function updateCaseWithLockFallback(
  update: Record<string, unknown>,
  buildQuery: (update: Record<string, unknown>) => {
    select: (columns: string) => { maybeSingle: () => PromiseLike<{ data: LockableCase | null; error: { code?: string; message?: string } | null }> };
  },
) {
  const { data, error } = await buildQuery(update)
    .select(lockAwareCaseSelect)
    .maybeSingle();
  if (!isMissingLockColumn(error)) return { data, error };

  const fallbackUpdate = { ...update };
  delete fallbackUpdate.locked_at;
  delete fallbackUpdate.lock_expires_at;
  return buildQuery(fallbackUpdate)
    .select(baseCaseSelect)
    .maybeSingle()
    .then((result) => ({
      data: result.data ? { ...result.data, locked_at: null, lock_expires_at: null } : null,
      error: result.error,
    }));
}

async function writeLockAudit(
  admin: AdminClient,
  current: Awaited<ReturnType<typeof readCase>>,
  consultantId: string,
  nextStatus: string,
) {
  if (nextStatus !== current.status) {
    await admin.from("diagnostic_status_history").insert({
      case_id: current.id,
      from_status: current.status,
      to_status: nextStatus,
      actor_type: "consultant",
      actor_user_id: consultantId,
      note: "Revisão iniciada e caso reservado para a consultora responsável.",
    });
  }
  await writeAudit(admin, {
    caseId: current.id,
    actorUserId: consultantId,
    actorType: "consultant",
    action: "diagnostic.claimed",
    metadata: { previousStatus: current.status, status: nextStatus },
  });
}

export async function claimCaseForReview(admin: AdminClient, caseId: string, consultantId: string) {
  const current = await readCase(admin, caseId);
  if (!isCaseLockActive(current.status)) return current;
  const now = new Date();
  const nowIso = now.toISOString();
  const lockExpiresAt = lockExpirationFrom(now);
  const nextStatus = statusesThatStartReview.has(current.status) ? "in_review" : current.status;

  if (current.assigned_consultant_id === consultantId) {
    const { data: refreshed, error } = await updateCaseWithLockFallback(
      { status: nextStatus, locked_at: current.locked_at ?? nowIso, lock_expires_at: lockExpiresAt },
      (update) => admin
        .from("diagnostic_cases")
        .update(update)
        .eq("id", caseId)
        .eq("assigned_consultant_id", consultantId),
    );
    if (error) throw error;
    const result = refreshed ?? await readCase(admin, caseId);
    return result;
  }

  if (current.assigned_consultant_id && !isAssignedLockExpired(current, now)) {
    throw await lockedCaseError(admin, current.assigned_consultant_id);
  }

  const { data: claimed, error } = await updateCaseWithLockFallback(
    {
      assigned_consultant_id: consultantId,
      status: nextStatus,
      locked_at: nowIso,
      lock_expires_at: lockExpiresAt,
    },
    (update) => {
      let query = admin
        .from("diagnostic_cases")
        .update(update)
        .eq("id", caseId)
        .eq("status", current.status);

      query = current.assigned_consultant_id
        ? current.lock_expires_at
          ? query.eq("assigned_consultant_id", current.assigned_consultant_id).eq("lock_expires_at", current.lock_expires_at)
          : query.eq("assigned_consultant_id", current.assigned_consultant_id)
        : query.is("assigned_consultant_id", null);

      return query;
    },
  );
  if (error) throw error;

  if (!claimed) {
    const latest = await readCase(admin, caseId);
    if (latest.assigned_consultant_id === consultantId || !isCaseLockActive(latest.status)) return latest;
    if (latest.assigned_consultant_id && !isAssignedLockExpired(latest)) throw await lockedCaseError(admin, latest.assigned_consultant_id);
    throw new ApiError(409, "O simulador foi atualizado por outra pessoa. Atualize a lista e tente novamente.", "CASE_LOCK_CONFLICT");
  }

  await writeLockAudit(admin, current, consultantId, nextStatus);
  return claimed;
}

export async function releaseCaseLock(admin: AdminClient, caseId: string, consultantId: string) {
  const current = await readCase(admin, caseId);
  if (!isCaseLockActive(current.status) || current.assigned_consultant_id !== consultantId) return current;

  const { data: released, error } = await updateCaseWithLockFallback(
    { assigned_consultant_id: null, locked_at: null, lock_expires_at: null },
    (update) => admin
      .from("diagnostic_cases")
      .update(update)
      .eq("id", caseId)
      .eq("assigned_consultant_id", consultantId),
  );
  if (error) throw error;

  const result = released ?? await readCase(admin, caseId);
  if (released) {
    await writeAudit(admin, {
      caseId,
      actorUserId: consultantId,
      actorType: "consultant",
      action: "diagnostic.released",
      metadata: { status: released.status },
    });
  }
  return result;
}

export async function decorateCaseLocks<T extends LockableCase>(admin: AdminClient, cases: T[], consultantId: string) {
  const ownerIds = [...new Set(cases
    .filter((item) => isCaseLockActive(item.status) && item.assigned_consultant_id && item.assigned_consultant_id !== consultantId && !isAssignedLockExpired(item))
    .map((item) => item.assigned_consultant_id as string))];
  const ownerNames = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data, error } = await admin.from("diagnostic_consultants").select("user_id,display_name").in("user_id", ownerIds);
    if (error) throw error;
    for (const owner of data ?? []) ownerNames.set(owner.user_id, owner.display_name);
  }

  return cases.map((item) => {
    const lockedByOther = Boolean(isCaseLockActive(item.status) && item.assigned_consultant_id && item.assigned_consultant_id !== consultantId && !isAssignedLockExpired(item));
    return {
      ...item,
      locked_by_other: lockedByOther,
      locked_by_name: lockedByOther && item.assigned_consultant_id
        ? ownerNames.get(item.assigned_consultant_id) ?? "Outra consultora"
        : null,
    };
  });
}
