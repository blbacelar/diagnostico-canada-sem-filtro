import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  admin,
  MockApiError,
  enforceRateLimit,
  getAdminSupabase,
  getOperationalConfig,
  hasPurchasedAccessForEmail,
  sendContinuationEmail,
  upsertCentralClient,
  writeAudit,
} = vi.hoisted(() => ({
  admin: { from: vi.fn() },
  MockApiError: class MockApiError extends Error {
    constructor(public status: number, message: string, public code = "REQUEST_ERROR") {
      super(message);
    }
  },
  enforceRateLimit: vi.fn(),
  getAdminSupabase: vi.fn(),
  getOperationalConfig: vi.fn(),
  hasPurchasedAccessForEmail: vi.fn(),
  sendContinuationEmail: vi.fn(),
  upsertCentralClient: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  ApiError: MockApiError,
  enforceRateLimit,
  handleApiError: (error: unknown) => Response.json({ error: error instanceof Error ? error.message : "Erro" }, { status: error instanceof MockApiError ? error.status : 500 }),
  json: (data: unknown, init: ResponseInit = {}) => Response.json(data, init),
  parseJson: async (request: Request) => JSON.parse(await request.text()),
  requestIp: () => "127.0.0.1",
  writeAudit,
}));

vi.mock("../../lib/supabase", () => ({ getAdminSupabase }));
vi.mock("../../lib/purchase-window", () => ({ hasPurchasedAccessForEmail }));
vi.mock("../../lib/central-client", () => ({ upsertCentralClient }));
vi.mock("../../lib/operational-config.server", () => ({ getOperationalConfig }));
vi.mock("../../lib/email", () => ({ sendContinuationEmail }));
vi.mock("../../lib/cases", () => ({ newCaseNumber: () => "CSF-2026-TESTE" }));
vi.mock("../../lib/tokens", () => ({
  createFormToken: () => "token-de-formulario-com-tamanho-suficiente",
  hashFormToken: () => "hash",
  tokenCookie: () => "diagnostic_form_token=token; Path=/",
}));

import { POST as startDiagnostic } from "../../app/api/diagnostics/start/route";
import { POST as resumeLink } from "../../app/api/diagnostics/resume-link/route";

const validStartPayload = {
  fullName: "Pessoa Teste",
  email: "cliente@example.com",
  emailConfirmation: "cliente@example.com",
  consent: true,
  policyVersion: "v1",
  source: "hotmart",
};

function request(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getAdminSupabase.mockReturnValue(admin);
  enforceRateLimit.mockResolvedValue(undefined);
  writeAudit.mockResolvedValue(undefined);
  getOperationalConfig.mockResolvedValue({ formLinkDays: 7 });
});

describe("validação de compra para acesso ao simulador", () => {
  it("não cria caso nem envia link quando o e-mail não tem compra confirmada", async () => {
    hasPurchasedAccessForEmail.mockResolvedValue(false);

    const response = await startDiagnostic(request("/api/diagnostics/start", validStartPayload));
    const body = await response.json() as { code: string; error: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe("PURCHASE_REQUIRED");
    expect(body.error).toContain("compra confirmada");
    expect(hasPurchasedAccessForEmail).toHaveBeenCalledWith(admin, "cliente@example.com");
    expect(upsertCentralClient).not.toHaveBeenCalled();
    expect(sendContinuationEmail).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalledWith("diagnostic_cases");
    expect(writeAudit).toHaveBeenCalledWith(admin, expect.objectContaining({
      actorType: "system",
      action: "diagnostic.start_denied_without_purchase",
      metadata: { reason: "purchase_not_found" },
    }));
  });

  it("não reenvia link de continuação quando o e-mail não tem compra confirmada", async () => {
    hasPurchasedAccessForEmail.mockResolvedValue(false);

    const response = await resumeLink(request("/api/diagnostics/resume-link", { email: "cliente@example.com" }));
    const body = await response.json() as { code: string; error: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe("PURCHASE_REQUIRED");
    expect(body.error).toContain("compra confirmada");
    expect(hasPurchasedAccessForEmail).toHaveBeenCalledWith(admin, "cliente@example.com");
    expect(sendContinuationEmail).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalledWith("clients");
  });
});
