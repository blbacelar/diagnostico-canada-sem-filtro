import { describe, expect, it } from "vitest";
import {
  attachPurchaseRecord,
  buildPurchaseWindow,
  mapPurchaseWindowsByEmail,
  type AllowedEmailEventRow,
} from "../../lib/purchase-window";

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

  it("usa a data real da compra em vez da data do último evento", () => {
    const row: AllowedEmailEventRow = {
      email: "cliente@example.com",
      last_event: "PURCHASE_COMPLETE",
      created_at: "2026-08-01T22:12:34.226Z",
      updated_at: "2026-08-09T12:31:51.988Z",
      last_event_at: "2026-08-09T12:31:49.779Z",
      external_reference: "HP0812626898",
      purchase_date: "2026-08-02T02:12:15.000Z",
      active: true,
    };

    const result = buildPurchaseWindow(row, new Date("2026-08-11T12:00:00.000Z"));

    expect(result.purchaseDate).toBe("2026-08-02T02:12:15.000Z");
    expect(result.daysSincePurchase).toBe(9);
    expect(result.eligibleToSend).toBe(true);
  });

  it("usa a data de criação do acesso como fallback legado antes do último evento", () => {
    const row: AllowedEmailEventRow = {
      email: "cliente@example.com",
      last_event: "PURCHASE_COMPLETE",
      created_at: "2026-08-01T22:12:34.226Z",
      updated_at: "2026-08-09T12:31:51.988Z",
      last_event_at: "2026-08-09T12:31:49.779Z",
      active: true,
    };

    const result = buildPurchaseWindow(row, new Date("2026-08-11T12:00:00.000Z"));

    expect(result.purchaseDate).toBe("2026-08-01T22:12:34.226Z");
    expect(result.eligibleToSend).toBe(true);
  });

  it("anexa a data canônica da tabela de compras ao registro de acesso", () => {
    const row: AllowedEmailEventRow = {
      email: "cliente@example.com",
      last_event: "PURCHASE_COMPLETE",
      updated_at: "2026-08-09T12:31:51.988Z",
      last_event_at: "2026-08-09T12:31:49.779Z",
      active: true,
    };

    const result = attachPurchaseRecord(row, { purchase_date: "2026-08-02T02:12:15.000Z" });

    expect(result.purchase_date).toBe("2026-08-02T02:12:15.000Z");
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
