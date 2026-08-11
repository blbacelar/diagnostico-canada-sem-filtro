import { describe, expect, it, vi } from "vitest";
import { upsertCentralClient } from "../../lib/central-client";

describe("cadastro central de clientes", () => {
  it("normaliza o e-mail e usa upsert na chave de negócio", async () => {
    const query = {
      upsert: vi.fn(() => query),
      select: vi.fn(() => query),
      single: vi.fn().mockResolvedValue({
        data: { id: "client-1", name: "Bruno Bacelar", email: "bruno@example.com" },
        error: null,
      }),
    };
    const admin = { from: vi.fn(() => query) } as never;

    const client = await upsertCentralClient(admin, {
      name: " Bruno Bacelar ",
      email: " Bruno@Example.COM ",
      statusJourney: "diagnostico_enviado",
      source: "diagnostic",
    });

    expect(client.email).toBe("bruno@example.com");
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Bruno Bacelar", email: "bruno@example.com", status_journey: "diagnostico_enviado" }),
      { onConflict: "email" },
    );
    expect(query.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ source: expect.any(String) }),
      expect.anything(),
    );
  });
});
