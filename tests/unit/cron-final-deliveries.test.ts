import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../../app/api/cron/final-deliveries/route";
import { config } from "../../vercel";

describe("cron de entregas finais", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("não executa sem o segredo do cron", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-de-teste-seguro");

    const response = await GET(new Request("http://localhost/api/cron/final-deliveries"));

    expect(response.status).toBe(401);
  });

  it("não aceita um segredo incorreto", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-de-teste-seguro");

    const response = await GET(new Request("http://localhost/api/cron/final-deliveries", {
      headers: { authorization: "Bearer segredo-incorreto-xx" },
    }));

    expect(response.status).toBe(401);
  });

  it("registra a execução diária de entregas no projeto", () => {
    expect(config.crons).toContainEqual({
      path: "/api/cron/final-deliveries",
      schedule: "17 0 * * *",
    });
  });
});
