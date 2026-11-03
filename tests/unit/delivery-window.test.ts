import { describe, expect, it } from "vitest";

import { buildDeliveryWindow, formatDeliveryDeadline, getDeliveryReleaseAt } from "../../lib/delivery-window";

const approvedPurchase = {
  purchaseDate: "2026-11-02T12:00:00.000Z",
  purchaseEvent: "PURCHASE_APPROVED",
};

describe("janela de entrega do simulador", () => {
  it("conta sete dias úteis a partir do envio das respostas", () => {
    const submittedAt = "2026-11-04T12:00:00.000Z"; // quarta-feira

    expect(getDeliveryReleaseAt(submittedAt)).toBe("2026-11-13T12:00:00.000Z");
    expect(formatDeliveryDeadline(getDeliveryReleaseAt(submittedAt))).toBe("13 de novembro de 2026");
  });

  it("não conta sábado e domingo como dias úteis", () => {
    const submittedAt = "2026-11-06T12:00:00.000Z"; // sexta-feira

    expect(getDeliveryReleaseAt(submittedAt)).toBe("2026-11-17T12:00:00.000Z");
  });

  it("libera o envio desde o início da data calculada", () => {
    const submittedAt = "2026-11-04T12:00:00.000Z";

    expect(buildDeliveryWindow(approvedPurchase, submittedAt, new Date("2026-11-12T23:59:59.999Z")).eligibleToSend).toBe(false);
    expect(buildDeliveryWindow(approvedPurchase, submittedAt, new Date("2026-11-13T00:00:00.000Z")).eligibleToSend).toBe(true);
  });

  it("permite exceção apenas quando há compra aprovada e respostas enviadas", () => {
    const waiting = buildDeliveryWindow(approvedPurchase, "2026-11-04T12:00:00.000Z", new Date("2026-11-06T12:00:00.000Z"));
    const withoutPurchase = buildDeliveryWindow(null, "2026-11-04T12:00:00.000Z");

    expect(waiting.canOverrideWaitPeriod).toBe(true);
    expect(withoutPurchase.canOverrideWaitPeriod).toBe(false);
  });
});
