import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireConsultant, getOperationalConfig, createFormToken, hashFormToken, newCaseNumber } = vi.hoisted(() => ({
  requireConsultant: vi.fn(),
  getOperationalConfig: vi.fn(),
  createFormToken: vi.fn(),
  hashFormToken: vi.fn(),
  newCaseNumber: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api")>(),
  requireConsultant,
}));
vi.mock("../../lib/operational-config.server", () => ({ getOperationalConfig }));
vi.mock("../../lib/tokens", () => ({ createFormToken, hashFormToken }));
vi.mock("../../lib/cases", () => ({ newCaseNumber }));

import { POST } from "../../app/api/dashboard/cases/[id]/reassessment/route";

const sourceCaseId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  getOperationalConfig.mockResolvedValue({ formLinkDays: 14 });
  createFormToken.mockReturnValue("token/seguro");
  hashFormToken.mockReturnValue("a".repeat(64));
  newCaseNumber.mockReturnValue("CSF-2026-NOVO01");
});

describe("criação de novo diagnóstico", () => {
  it("cria um rascunho pré-preenchido e devolve o formulário editável", async () => {
    const sourceQuery = {
      select: vi.fn(() => sourceQuery),
      eq: vi.fn(() => sourceQuery),
      is: vi.fn(() => sourceQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: sourceCaseId, status: "sent" }, error: null }),
    };
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "00000000-0000-4000-8000-000000000002", case_number: "CSF-2026-NOVO01" }], error: null });
    requireConsultant.mockResolvedValue({ admin: { from: vi.fn(() => sourceQuery), rpc }, user: { id: "consultant-1" } });

    const response = await POST(
      new Request(`http://localhost/api/dashboard/cases/${sourceCaseId}/reassessment`, { method: "POST" }),
      { params: Promise.resolve({ id: sourceCaseId }) },
    );
    const body = await response.json() as { caseId: string; caseNumber: string; editUrl: string };

    expect(response.status).toBe(201);
    expect(body).toEqual({
      caseId: "00000000-0000-4000-8000-000000000002",
      caseNumber: "CSF-2026-NOVO01",
      editUrl: "/formulario?token=token%2Fseguro&origem=dashboard",
    });
    expect(rpc).toHaveBeenCalledWith("create_diagnostic_reassessment", expect.objectContaining({
      p_source_case_id: sourceCaseId,
      p_consultant_id: "consultant-1",
      p_case_number: "CSF-2026-NOVO01",
      p_token_hash: "a".repeat(64),
    }));
  });
});
