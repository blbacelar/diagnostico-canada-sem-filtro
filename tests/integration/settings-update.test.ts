import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireConsultant: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return { ...actual, requireConsultant: mocks.requireConsultant, writeAudit: mocks.writeAudit };
});

import { PATCH } from "../../app/api/dashboard/settings/route";

const payload = {
  policy_version: "2026-08-04",
  methodology_version: "1.1.0",
  prompt_version: "2026-08-04",
  model: "openai/gpt-5.6-terra",
  form_link_days: 21,
  report_link_days: 45,
  review_sla_hours: 36,
  revision: 4,
};

function request(body: unknown = payload) {
  return new Request("http://localhost/api/dashboard/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function adminReturning(data: Record<string, unknown> | null) {
  const builder = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  const admin = { from: vi.fn().mockReturnValue(builder) };
  return { admin, builder };
}

describe("atualização dos parâmetros operacionais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeAudit.mockResolvedValue(undefined);
  });

  it("exige administradora, persiste por revisão e registra auditoria", async () => {
    const updated = { ...payload, revision: 5, updated_at: "2026-08-04T02:00:00Z" };
    const { admin, builder } = adminReturning(updated);
    mocks.requireConsultant.mockResolvedValue({ admin, user: { id: "admin-user" } });

    const response = await PATCH(request());
    const body = await response.json() as { operation: typeof updated };

    expect(response.status).toBe(200);
    expect(mocks.requireConsultant).toHaveBeenCalledWith(expect.any(Request), "admin");
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ report_link_days: 45, updated_by: "admin-user" }));
    expect(builder.eq).toHaveBeenNthCalledWith(1, "id", 1);
    expect(builder.eq).toHaveBeenNthCalledWith(2, "revision", 4);
    expect(body.operation.revision).toBe(5);
    expect(mocks.writeAudit).toHaveBeenCalledWith(admin, expect.objectContaining({ action: "settings.updated", actorUserId: "admin-user" }));
  });

  it("impede sobrescrita quando a revisão já mudou", async () => {
    const { admin } = adminReturning(null);
    mocks.requireConsultant.mockResolvedValue({ admin, user: { id: "admin-user" } });

    const response = await PATCH(request());
    const body = await response.json() as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe("STALE_SETTINGS");
    expect(mocks.writeAudit).not.toHaveBeenCalled();
  });

  it("rejeita limites inválidos antes de acessar a tabela", async () => {
    const { admin } = adminReturning(null);
    mocks.requireConsultant.mockResolvedValue({ admin, user: { id: "admin-user" } });

    const response = await PATCH(request({ ...payload, form_link_days: 0 }));

    expect(response.status).toBe(422);
    expect(admin.from).not.toHaveBeenCalled();
  });
});
