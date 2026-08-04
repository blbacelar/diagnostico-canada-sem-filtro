import { describe, expect, it } from "vitest";
import { getCaseStatusLabel, getDeliveryStatusMessage, getReviewStatusLabel } from "../../lib/status-labels";

describe("tradução de estados técnicos", () => {
  it("traduz os estados exibidos no detalhe do diagnóstico", () => {
    expect(getCaseStatusLabel("ready_for_approval")).toBe("Pronto para aprovação");
    expect(getCaseStatusLabel("sent")).toBe("Enviado");
    expect(getReviewStatusLabel("approved")).toBe("Aprovado");
  });

  it("exibe a confirmação da entrega integralmente em português", () => {
    expect(getDeliveryStatusMessage("sent")).toBe("Entrega enviada. O histórico foi atualizado.");
  });

  it("não revela códigos internos desconhecidos na interface", () => {
    expect(getCaseStatusLabel("unknown_internal_status")).toBe("Status indisponível");
    expect(getReviewStatusLabel("unknown_internal_status")).toBe("Status indisponível");
    expect(getDeliveryStatusMessage("unknown_internal_status")).toBe("O estado da entrega não pôde ser confirmado.");
  });
});
