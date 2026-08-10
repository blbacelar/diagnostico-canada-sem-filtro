import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireConsultant, getOperationalConfig, createFormToken, hashFormToken } = vi.hoisted(() => ({
  requireConsultant: vi.fn(),
  getOperationalConfig: vi.fn(),
  createFormToken: vi.fn(),
  hashFormToken: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api")>(),
  requireConsultant,
}));
vi.mock("../../lib/operational-config.server", () => ({ getOperationalConfig }));
vi.mock("../../lib/tokens", () => ({ createFormToken, hashFormToken }));

import { POST } from "../../app/api/dashboard/cases/[id]/form-token/route";

const targetCaseId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  getOperationalConfig.mockResolvedValue({ formLinkDays: 14 });
  createFormToken.mockReturnValue("token/edit-consultant");
  hashFormToken.mockReturnValue("b".repeat(64));
});

describe("geração de link de edição pelo consultor", () => {
  it("gerencia o rascunho e devolve a URL de edição sem alterar a entrega", async () => {
    const updateMock = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    const casesQuery = {
      select: vi.fn(() => casesQuery),
      eq: vi.fn(() => casesQuery),
      is: vi.fn(() => casesQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: targetCaseId, case_number: "DCF-001", status: "client_draft", source_metadata: {} },
        error: null,
      }),
      update: updateMock,
    };

    const tokensQuery = {
      update: vi.fn(() => tokensQuery),
      eq: vi.fn(() => tokensQuery),
      is: vi.fn(() => tokensQuery),
      insert: insertMock,
    };

    const from = vi.fn((table: string) => (table === "diagnostic_cases" ? casesQuery : tokensQuery));
    requireConsultant.mockResolvedValue({ admin: { from }, user: { id: "consultant-1" } });

    const response = await POST(
      new Request(`http://localhost/api/dashboard/cases/${targetCaseId}/form-token`, { method: "POST" }),
      { params: Promise.resolve({ id: targetCaseId }) },
    );
    const body = await response.json() as { caseId: string; caseNumber: string; editUrl: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      caseId: targetCaseId,
      caseNumber: "DCF-001",
      editUrl: "/formulario?token=token%2Fedit-consultant&origem=dashboard",
    });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      source_metadata: expect.objectContaining({ consultant_managed: true, last_edited_by_consultant_id: "consultant-1" }),
    }));
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      case_id: targetCaseId,
      token_hash: "b".repeat(64),
    }));
  });

  it("impede edição apenas durante o envio ativo", async () => {
    const casesQuery = {
      select: vi.fn(() => casesQuery),
      eq: vi.fn(() => casesQuery),
      is: vi.fn(() => casesQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: targetCaseId, case_number: "DCF-001", status: "sending", source_metadata: {} },
        error: null,
      }),
    };
    requireConsultant.mockResolvedValue({ admin: { from: vi.fn(() => casesQuery) }, user: { id: "consultant-1" } });

    const response = await POST(
      new Request(`http://localhost/api/dashboard/cases/${targetCaseId}/form-token`, { method: "POST" }),
      { params: Promise.resolve({ id: targetCaseId }) },
    );
    const body = await response.json() as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe("CASE_IMMUTABLE");
  });
});
