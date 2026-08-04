import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdminSupabase, getSupabaseForAccessToken } = vi.hoisted(() => ({
  getAdminSupabase: vi.fn(),
  getSupabaseForAccessToken: vi.fn(),
}));

const { hashIp } = vi.hoisted(() => ({
  hashIp: vi.fn(() => "hashed-identifier"),
}));

vi.mock("../../lib/supabase", () => ({ getAdminSupabase, getSupabaseForAccessToken }));
vi.mock("../../lib/tokens", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/tokens")>(),
  hashIp,
}));

import { ApiError, enforceRateLimit, requireConsultant } from "../../lib/api";

describe("alertas de segurança em api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SECURITY_ALERT_WEBHOOK_URL;
  });

  it("registra alerta quando falta bearer token", async () => {
    process.env.SECURITY_ALERT_WEBHOOK_URL = "https://alerts.example/webhook";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    await expect(requireConsultant(new Request("http://localhost/api/private"))).rejects.toBeInstanceOf(ApiError);

    expect(warn).toHaveBeenCalledWith("security_event", expect.objectContaining({ event: "auth_missing_bearer" }));
    expect(fetchMock).toHaveBeenCalledWith("https://alerts.example/webhook", expect.objectContaining({ method: "POST" }));
  });

  it("registra alerta quando rate limit estoura", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "rl-1", request_count: 999 }, error: null }),
    };
    getAdminSupabase.mockReturnValue({ from: vi.fn(() => query) });

    await expect(enforceRateLimit(new Request("http://localhost/api/private"), "diagnostic_send_final", 20, 15)).rejects.toBeInstanceOf(ApiError);
    expect(warn).toHaveBeenCalledWith("security_event", expect.objectContaining({ event: "rate_limited", action: "diagnostic_send_final" }));
  });
});
