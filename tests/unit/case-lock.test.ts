import { describe, expect, it, vi } from "vitest";
import { claimCaseForReview, decorateCaseLocks, releaseCaseLock } from "../../lib/case-lock";

type CaseRow = {
  id: string;
  case_number: string;
  status: string;
  objective: string | null;
  submitted_at: string | null;
  updated_at: string;
  assigned_consultant_id: string | null;
  client_id: string;
};

function adminStub(input: { current: CaseRow; claimed?: CaseRow | null; ownerName?: string }) {
  const update = vi.fn(() => ({
    eq: () => ({
      eq: () => {
        const result = {
          is: () => ({
            select: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: input.claimed ?? null, error: null }) }),
          }),
          select: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: input.claimed ?? null, error: null }) }),
        };
        return result;
      },
    }),
  }));
  const historyInsert = vi.fn().mockResolvedValue({ error: null });
  const auditInsert = vi.fn().mockResolvedValue({ error: null });
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "diagnostic_cases") return {
        select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: input.current, error: null }) }) }),
        update,
      };
      if (table === "diagnostic_consultants") return {
        select: () => ({
          eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { display_name: input.ownerName ?? "Consultora B" }, error: null }) }),
          in: vi.fn().mockResolvedValue({ data: [{ user_id: "consultant-b", display_name: input.ownerName ?? "Consultora B" }], error: null }),
        }),
      };
      if (table === "diagnostic_status_history") return { insert: historyInsert };
      if (table === "diagnostic_audit_logs") return { insert: auditInsert };
      throw new Error(`Tabela inesperada: ${table}`);
    }),
  };
  return { admin, update, historyInsert, auditInsert };
}

const availableCase: CaseRow = {
  id: "case-1",
  case_number: "CSF-2026-0001",
  status: "awaiting_triage",
  objective: "Trabalho",
  submitted_at: "2026-08-04T03:00:00Z",
  updated_at: "2026-08-04T03:00:00Z",
  assigned_consultant_id: null,
  client_id: "client-1",
};

describe("reserva exclusiva de diagnóstico", () => {
  it("reserva atomicamente o caso para a primeira consultora e inicia a revisão", async () => {
    const claimed = { ...availableCase, status: "in_review", assigned_consultant_id: "consultant-a" };
    const { admin, update, historyInsert, auditInsert } = adminStub({ current: availableCase, claimed });

    const result = await claimCaseForReview(admin as never, availableCase.id, "consultant-a");

    expect(result).toEqual(claimed);
    expect(update).toHaveBeenCalledWith({ assigned_consultant_id: "consultant-a", status: "in_review" });
    expect(historyInsert).toHaveBeenCalledWith(expect.objectContaining({ from_status: "awaiting_triage", to_status: "in_review", actor_user_id: "consultant-a" }));
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "diagnostic.claimed", actor_user_id: "consultant-a" }));
  });

  it("bloqueia a segunda consultora antes de devolver os dados do caso", async () => {
    const ownedCase = { ...availableCase, status: "in_review", assigned_consultant_id: "consultant-b" };
    const { admin, update } = adminStub({ current: ownedCase, ownerName: "Maria Consultora" });

    await expect(claimCaseForReview(admin as never, ownedCase.id, "consultant-a")).rejects.toMatchObject({
      status: 423,
      code: "CASE_LOCKED",
      message: "Este diagnóstico já está em revisão por Maria Consultora.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("marca na lista os casos que pertencem a outra consultora", async () => {
    const ownedCase = { ...availableCase, status: "in_review", assigned_consultant_id: "consultant-b" };
    const { admin } = adminStub({ current: ownedCase, ownerName: "Maria Consultora" });

    const [decorated] = await decorateCaseLocks(admin as never, [ownedCase], "consultant-a");

    expect(decorated).toMatchObject({ locked_by_other: true, locked_by_name: "Maria Consultora" });
  });

  it("libera o caso apenas quando pertence à consultora atual", async () => {
    const ownedCase = { ...availableCase, status: "in_review", assigned_consultant_id: "consultant-a" };
    const releasedCase = { ...ownedCase, assigned_consultant_id: null };
    const { admin, update, auditInsert } = adminStub({ current: ownedCase, claimed: releasedCase });

    const result = await releaseCaseLock(admin as never, ownedCase.id, "consultant-a");

    expect(result).toEqual(releasedCase);
    expect(update).toHaveBeenCalledWith({ assigned_consultant_id: null });
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "diagnostic.released", actor_user_id: "consultant-a" }));
  });

  it("não libera o caso reservado por outra consultora", async () => {
    const ownedCase = { ...availableCase, status: "in_review", assigned_consultant_id: "consultant-b" };
    const { admin, update, auditInsert } = adminStub({ current: ownedCase });

    const result = await releaseCaseLock(admin as never, ownedCase.id, "consultant-a");

    expect(result).toEqual(ownedCase);
    expect(update).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
  });
});
