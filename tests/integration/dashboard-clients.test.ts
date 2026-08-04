import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/dashboard/clients/route";

describe("API de clientes do dashboard", () => {
  it("recusa requisições sem uma sessão autenticada", async () => {
    const response = await GET(new Request("http://localhost/api/dashboard/clients"));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
