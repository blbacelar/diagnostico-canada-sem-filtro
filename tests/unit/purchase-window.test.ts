import { describe, expect, it } from "vitest";
import {
  attachPurchaseRecord,
  buildPurchaseWindow,
  isAllowedEmailAccessActive,
  isDiagnosticProductPurchase,
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

    const result = attachPurchaseRecord(row, {
      product_name: "7 Aulas + E-Book + App + Diagnóstico - O Canadá é pra você?",
      status_hotmart: "APPROVED",
      purchase_date: "2026-08-02T02:12:15.000Z",
    });

    expect(result.purchase_date).toBe("2026-08-02T02:12:15.000Z");
    expect(result.last_event).toBe("APPROVED");
    expect(result.purchase_verified).toBe(true);
  });

  it("preserva um acesso Hotmart aprovado legado quando a relação purchases ainda não foi migrada", () => {
    const row: AllowedEmailEventRow = {
      email: "cliente@example.com",
      last_event: "PURCHASE_COMPLETE",
      created_at: "2026-08-01T22:12:34.226Z",
      updated_at: "2026-08-09T12:31:51.988Z",
      last_event_at: "2026-08-09T12:31:49.779Z",
      source: "hotmart",
      notes: "Access granted by Hotmart webhook.",
      active: true,
    };

    const attached = attachPurchaseRecord(row, null);
    const result = buildPurchaseWindow(attached, new Date("2026-08-11T12:00:00.000Z"));

    expect(attached.purchase_verified).toBe(true);
    expect(result.purchaseDate).toBe("2026-08-01T22:12:34.226Z");
    expect(result.eligibleToSend).toBe(true);
  });

  it("não usa o fallback legado para uma inscrição de masterclass", () => {
    const row: AllowedEmailEventRow = {
      email: "cliente@example.com",
      last_event: "PURCHASE_APPROVED",
      created_at: "2026-08-01T22:12:34.226Z",
      updated_at: "2026-08-09T12:31:51.988Z",
      last_event_at: "2026-08-09T12:31:49.779Z",
      source: "hotmart",
      notes: "Inscrição na masterclass, sem compra do simulador.",
      active: true,
    };

    const attached = attachPurchaseRecord(row, null);
    const result = buildPurchaseWindow(attached, new Date("2026-08-11T12:00:00.000Z"));

    expect(attached.purchase_verified).toBe(false);
    expect(result.eligibleToSend).toBe(false);
  });

  it("não considera masterclass como compra válida do simulador", () => {
    expect(isDiagnosticProductPurchase({
      product_name: "Masterclass Canadá Sem Filtro",
      status_hotmart: "APPROVED",
    })).toBe(false);
  });

  it("não considera nome genérico com diagnóstico como produto válido", () => {
    expect(isDiagnosticProductPurchase({
      product_name: "Masterclass + Diagnóstico Canadá Sem Filtro",
      status_hotmart: "APPROVED",
    })).toBe(false);
  });

  it("aceita o bundle 8575181 enquanto a compra aprovada não expirou", () => {
    expect(isDiagnosticProductPurchase({
      product_id: 8575181,
      product_name: "Simulador + Diário de Bordo",
      status_hotmart: "PURCHASE_APPROVED",
      access_expires_at: "2027-09-22T12:00:00.000Z",
    }, new Date("2026-09-22T12:00:00.000Z"))).toBe(true);
  });

  it("nega o bundle expirado, pendente ou estornado", () => {
    const bundle = {
      product_id: 8575181,
      product_name: "Simulador + Diário de Bordo",
      access_expires_at: "2027-09-22T12:00:00.000Z",
    };
    const now = new Date("2027-09-22T12:00:00.000Z");

    expect(isDiagnosticProductPurchase({ ...bundle, status_hotmart: "PURCHASE_APPROVED" }, now)).toBe(false);
    expect(isDiagnosticProductPurchase({ ...bundle, status_hotmart: "PURCHASE_PENDING" }, now)).toBe(false);
    expect(isDiagnosticProductPurchase({ ...bundle, status_hotmart: "PURCHASE_REFUNDED" }, now)).toBe(false);
    expect(isDiagnosticProductPurchase({ ...bundle, status_hotmart: "PURCHASE_APPROVED", access_expires_at: null }, now)).toBe(false);
  });

  it("não aceita outro produto mesmo que tenha uma validade anual", () => {
    expect(isDiagnosticProductPurchase({
      product_id: 1234567,
      product_name: "Diário de Bordo",
      status_hotmart: "PURCHASE_APPROVED",
      access_expires_at: "2027-09-22T12:00:00.000Z",
    }, new Date("2026-09-22T12:00:00.000Z"))).toBe(false);
  });

  it("considera allowed_emails manual ativo como acesso liberado", () => {
    expect(isAllowedEmailAccessActive({
      active: true,
      last_event: null,
      source: "manual",
      notes: null,
    })).toBe(true);
  });

  it("não considera allowed_emails com reembolso como acesso liberado", () => {
    expect(isAllowedEmailAccessActive({
      active: true,
      last_event: "PURCHASE_REFUNDED",
      source: "hotmart",
      notes: null,
    })).toBe(false);
  });

  it("não considera allowed_emails de masterclass como acesso ao simulador", () => {
    expect(isAllowedEmailAccessActive({
      active: true,
      last_event: "PURCHASE_APPROVED",
      source: "hotmart",
      notes: "Inscrição na masterclass, sem compra do simulador.",
    })).toBe(false);
  });

  it("não usa allowed_emails do bundle após o vencimento", () => {
    const row = {
      active: true,
      last_event: "PURCHASE_APPROVED",
      source: "hotmart",
      notes: null,
      access_product_id: 8575181,
      access_expires_at: "2027-09-22T12:00:00.000Z",
    };
    expect(isAllowedEmailAccessActive(row, new Date("2027-09-22T11:59:59.000Z"))).toBe(true);
    expect(isAllowedEmailAccessActive(row, new Date("2027-09-22T12:00:00.000Z"))).toBe(false);
    expect(isAllowedEmailAccessActive({ ...row, access_expires_at: null })).toBe(false);
  });

  it("bloqueia a entrega do simulador quando o bundle expirou", () => {
    const row: AllowedEmailEventRow = {
      email: "cliente@example.com",
      last_event: "PURCHASE_APPROVED",
      purchase_date: "2026-09-22T12:00:00.000Z",
      updated_at: "2026-09-22T12:00:00.000Z",
      last_event_at: "2026-09-22T12:00:00.000Z",
      active: true,
      access_product_id: 8575181,
      access_expires_at: "2027-09-22T12:00:00.000Z",
    };
    expect(buildPurchaseWindow(row, new Date("2026-10-01T12:00:00.000Z")).eligibleToSend).toBe(true);
    expect(buildPurchaseWindow(row, new Date("2027-09-22T12:00:00.000Z")).eligibleToSend).toBe(false);
  });

  it("bloqueia janela de compra quando o acesso veio de produto que não é o simulador", () => {
    const row: AllowedEmailEventRow = {
      email: "cliente@example.com",
      last_event: "PURCHASE_APPROVED",
      updated_at: "2026-08-09T12:31:51.988Z",
      last_event_at: "2026-08-09T12:31:49.779Z",
      active: true,
    };

    const attached = attachPurchaseRecord(row, {
      product_name: "Masterclass Canadá Sem Filtro",
      status_hotmart: "APPROVED",
      purchase_date: "2026-08-02T02:12:15.000Z",
    });
    const result = buildPurchaseWindow(attached, new Date("2026-08-11T12:00:00.000Z"));

    expect(result.eligibleToSend).toBe(false);
    expect(result.purchaseDate).toBeNull();
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
