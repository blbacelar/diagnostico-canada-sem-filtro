import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/dashboard/cases/[id]/reassessment/route";

describe("API de novo diagnóstico do dashboard", () => {
  it("exige uma sessão profissional autenticada", async () => {
    const response = await POST(
      new Request("http://localhost/api/dashboard/cases/00000000-0000-4000-8000-000000000001/reassessment", { method: "POST" }),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) },
    );
    const body = await response.json() as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
