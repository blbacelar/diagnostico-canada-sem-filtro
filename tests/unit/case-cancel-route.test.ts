import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireConsultant, writeAudit } = vi.hoisted(() => ({
  requireConsultant: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api")>(),
  requireConsultant,
  writeAudit,
}));

import { POST } from "../../app/api/dashboard/cases/[id]/cancel/route";

const caseId = "00000000-0000-4000-8000-000000000001";

describe("rota de cancelamento de simulador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeAudit.mockResolvedValue(undefined);
  });

  it("preserva o caso, interrompe a entrega e revoga os links", async () => {
    const caseReadQuery = {
      select: vi.fn(() => caseReadQuery),
      eq: vi.fn(() => caseReadQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: caseId, case_number: "CSF-2026-TESTE", status: "approved" },
        error: null,
      }),
    };
    const caseCancelQuery = {
      update: vi.fn(() => caseCancelQuery),
      eq: vi.fn(() => caseCancelQuery),
      in: vi.fn(() => caseCancelQuery),
      select: vi.fn(() => caseCancelQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: caseId, case_number: "CSF-2026-TESTE", status: "cancelled" },
        error: null,
      }),
    };
    const accessTokensQuery = {
      update: vi.fn(() => accessTokensQuery),
      eq: vi.fn(() => accessTokensQuery),
      is: vi.fn().mockResolvedValue({ error: null }),
    };
    const reportTokensQuery = {
      update: vi.fn(() => reportTokensQuery),
      eq: vi.fn(() => reportTokensQuery),
      is: vi.fn().mockResolvedValue({ error: null }),
    };
    const historyQuery = { insert: vi.fn().mockResolvedValue({ error: null }) };
    let casesCalls = 0;
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "diagnostic_cases") return casesCalls++ === 0 ? caseReadQuery : caseCancelQuery;
        if (table === "diagnostic_access_tokens") return accessTokensQuery;
        if (table === "diagnostic_report_tokens") return reportTokensQuery;
        if (table === "diagnostic_status_history") return historyQuery;
        throw new Error(`Tabela inesperada: ${table}`);
      }),
    };
    requireConsultant.mockResolvedValue({ admin, user: { id: "consultant-1" } });

    const response = await POST(
      new Request(`http://localhost/api/dashboard/cases/${caseId}/cancel`, { method: "POST" }),
      { params: Promise.resolve({ id: caseId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ case: { id: caseId, status: "cancelled" } });
    expect(caseCancelQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "cancelled",
      assigned_consultant_id: null,
      locked_at: null,
      lock_expires_at: null,
    }));
    expect(accessTokensQuery.update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) }));
    expect(reportTokensQuery.update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) }));
    expect(historyQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      from_status: "approved",
      to_status: "cancelled",
    }));
    expect(writeAudit).toHaveBeenCalledWith(admin, expect.objectContaining({ action: "diagnostic.cancelled" }));
  });

  it("mantém a operação idempotente para um caso já cancelado", async () => {
    const caseReadQuery = {
      select: vi.fn(() => caseReadQuery),
      eq: vi.fn(() => caseReadQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: caseId, case_number: "CSF-2026-TESTE", status: "cancelled" },
        error: null,
      }),
    };
    const admin = { from: vi.fn(() => caseReadQuery) };
    requireConsultant.mockResolvedValue({ admin, user: { id: "consultant-1" } });

    const response = await POST(
      new Request(`http://localhost/api/dashboard/cases/${caseId}/cancel`, { method: "POST" }),
      { params: Promise.resolve({ id: caseId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ alreadyCancelled: true });
    expect(writeAudit).not.toHaveBeenCalled();
  });
});
