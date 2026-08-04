import { describe, expect, it, vi } from "vitest";

const { getSupabaseForAccessToken } = vi.hoisted(() => ({
  getSupabaseForAccessToken: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({ getSupabaseForAccessToken }));

import { DELETE, POST } from "../../app/api/auth/session/route";

describe("endpoint de sessão do dashboard", () => {
  it("define cookie HttpOnly quando o token é válido", async () => {
    getSupabaseForAccessToken.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    });
    const response = await POST(new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { Authorization: "Bearer token-valido" },
    }));
    const body = await response.json() as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(response.headers.get("set-cookie")).toContain("dashboard_access_token=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("recusa sem bearer token", async () => {
    const response = await POST(new Request("http://localhost/api/auth/session", { method: "POST" }));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("limpa cookie no logout", async () => {
    const response = await DELETE();
    const body = await response.json() as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(response.headers.get("set-cookie")).toContain("dashboard_access_token=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
