import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  admin,
  formTokenFromRequest,
  getAdminSupabase,
  hasPurchasedAccessForEmail,
  hashFormToken,
  auditInsert,
  tokenUpdate,
} = vi.hoisted(() => ({
  admin: { from: vi.fn() },
  formTokenFromRequest: vi.fn(),
  getAdminSupabase: vi.fn(),
  hasPurchasedAccessForEmail: vi.fn(),
  hashFormToken: vi.fn(),
  auditInsert: vi.fn(),
  tokenUpdate: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  getAdminSupabase,
  getSupabaseForAccessToken: vi.fn(),
}));

vi.mock("../../lib/tokens", () => ({
  formTokenFromRequest,
  hashFormToken,
  hashIp: vi.fn(() => "ip-hash"),
}));

vi.mock("../../lib/purchase-window", () => ({ hasPurchasedAccessForEmail }));

import { ApiError, requireFormCase } from "../../lib/api";

function tokenQuery() {
  return {
    select: vi.fn(() => tokenQueryResult),
  };
}

const tokenQueryResult = {
  eq: vi.fn(() => tokenQueryResult),
  maybeSingle: vi.fn(),
};

const tokenUpdateQuery = {
  eq: vi.fn(() => tokenUpdateQuery),
  is: vi.fn(() => Promise.resolve({ error: null })),
};

beforeEach(() => {
  vi.clearAllMocks();
  formTokenFromRequest.mockReturnValue("token-de-formulario-com-tamanho-suficiente");
  hashFormToken.mockReturnValue("a".repeat(64));
  getAdminSupabase.mockReturnValue(admin);
  hasPurchasedAccessForEmail.mockResolvedValue(true);
  tokenUpdate.mockReturnValue(tokenUpdateQuery);
  auditInsert.mockResolvedValue({ error: null });
  admin.from.mockImplementation((table: string) => {
    if (table === "diagnostic_access_tokens") {
      return {
        ...tokenQuery(),
        update: tokenUpdate,
      };
    }
    if (table === "diagnostic_audit_logs") {
      return { insert: auditInsert };
    }
    return {};
  });
  tokenQueryResult.maybeSingle.mockResolvedValue({
    data: {
      id: "token-1",
      case_id: "case-1",
      expires_at: "2999-01-01T00:00:00.000Z",
      revoked_at: null,
      diagnostic_cases: {
        id: "case-1",
        case_number: "CSF-2026-TESTE",
        status: "client_draft",
        client_id: "client-1",
        submitted_at: null,
        source_metadata: {},
        archived_at: null,
        clients: { email: "lead@example.com" },
      },
    },
    error: null,
  });
});

describe("validação do token do formulário", () => {
  it("revoga token aparentemente válido quando o cliente não tem compra confirmada", async () => {
    hasPurchasedAccessForEmail.mockResolvedValue(false);

    await expect(requireFormCase(new Request("http://localhost/api/diagnostics/form-session"))).rejects.toMatchObject({
      status: 401,
      code: "INVALID_FORM_TOKEN",
    } satisfies Partial<ApiError>);

    expect(hasPurchasedAccessForEmail).toHaveBeenCalledWith(admin, "lead@example.com");
    expect(tokenUpdate).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) }));
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      case_id: "case-1",
      actor_type: "system",
      action: "diagnostic.form_access_denied_without_purchase",
      metadata: { reason: "purchase_not_found" },
    }));
  });
});
