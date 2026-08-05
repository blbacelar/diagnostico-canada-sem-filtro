import { describe, expect, it } from "vitest";
import { buildPurchaseWindow, mapPurchaseWindowsByEmail, type AllowedEmailEventRow } from "../../lib/purchase-window";

describe("janela de compra para entrega", () => {
  it("libera envio apenas após mais de 7 dias", () => {
    const row: AllowedEmailEventRow = {
      email: "cliente@example.com",
      last_event: "PURCHASE_APPROVED",
      updated_at: "2026-07-01T10:00:00.000Z",
      last_event_at: "2026-07-01T10:00:00.000Z",
      active: true,
    };

    const result = buildPurchaseWindow(row, new Date("2026-07-09T10:00:00.000Z"));

    expect(result.eligibleToSend).toBe(true);
    expect(result.daysSincePurchase).toBe(8);
    expect(result.daysRemaining).toBe(0);
  });

  it("bloqueia envio com menos de 7 dias", () => {
    const row: AllowedEmailEventRow = {
      email: "cliente@example.com",
      last_event: "PURCHASE_COMPLETE",
      updated_at: "2026-07-01T10:00:00.000Z",
      last_event_at: "2026-07-01T10:00:00.000Z",
      active: true,
    };

    const result = buildPurchaseWindow(row, new Date("2026-07-05T10:00:00.000Z"));

    expect(result.eligibleToSend).toBe(false);
    expect(result.daysSincePurchase).toBe(4);
    expect(result.daysRemaining).toBe(4);
  });

  it("usa o evento mais recente por e-mail", () => {
    const rows: AllowedEmailEventRow[] = [
      {
        email: "cliente@example.com",
        last_event: "PURCHASE_COMPLETE",
        updated_at: "2026-07-01T10:00:00.000Z",
        last_event_at: "2026-07-01T10:00:00.000Z",
        active: true,
      },
      {
        email: "cliente@example.com",
        last_event: "PURCHASE_APPROVED",
        updated_at: "2026-07-03T10:00:00.000Z",
        last_event_at: "2026-07-03T10:00:00.000Z",
        active: true,
      },
    ];

    const map = mapPurchaseWindowsByEmail(rows, new Date("2026-07-06T10:00:00.000Z"));
    const result = map.get("cliente@example.com");

    expect(result?.purchaseEvent).toBe("PURCHASE_APPROVED");
    expect(result?.daysSincePurchase).toBe(3);
  });
});
