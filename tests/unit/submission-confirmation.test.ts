import { describe, expect, it } from "vitest";
import { submissionDeliveryMessage, submissionReviewMessage } from "@/lib/submission-confirmation";

describe("mensagem de confirmação do simulador", () => {
  it("explica que a revisão é individual e feita por consultoras", () => {
    expect(submissionReviewMessage("CSF-2026-0YIUYF")).toBe(
      "O simulador CSF-2026-0YIUYF foi recebido e encaminhado para análise pelas nossas consultoras. Agora, elas vão revisar suas respostas com calma e de forma individual para preparar uma devolutiva personalizada.",
    );
  });

  it("informa somente o prazo médio, sem uma data fixa", () => {
    expect(submissionDeliveryMessage()).toBe(
      "Este processo leva, em média, até 7 dias úteis a partir do recebimento das suas respostas.",
    );
  });
});
