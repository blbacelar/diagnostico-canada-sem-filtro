import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { middleware } from "../../middleware";

function requestFor(path: string, token?: string) {
  const url = `http://localhost${path}`;
  return {
    url,
    nextUrl: new URL(url),
    cookies: {
      get: vi.fn((name: string) => {
        if (name !== "dashboard_access_token" || !token) return undefined;
        return { value: token };
      }),
    },
  } as unknown as NextRequest;
}

describe("middleware de proteção do dashboard", () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
  });

  it("redireciona para login quando não há cookie de sessão", async () => {
    const response = await middleware(requestFor("/dashboard/clientes"));
    const location = response.headers.get("location") ?? "";

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Fdashboard%2Fclientes");
  });

  it("permite continuar quando cookie existe e sessão no auth é válida", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const response = await middleware(requestFor("/dashboard", "token-ok"));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
