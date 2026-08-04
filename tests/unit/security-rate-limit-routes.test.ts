import { describe, expect, it, vi } from "vitest";

const { enforceRateLimit } = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api")>(),
  enforceRateLimit,
}));

import { POST as processAiPost } from "../../app/api/diagnostics/process-ai/route";
import { POST as sendPost } from "../../app/api/diagnostics/send/route";
import { POST as requestInformationPost } from "../../app/api/diagnostics/request-information/route";
import { ApiError } from "../../lib/api";

describe("rate limit em rotas de custo", () => {
  it("bloqueia process-ai quando o limite estoura", async () => {
    enforceRateLimit.mockRejectedValueOnce(new ApiError(429, "Muitas tentativas.", "RATE_LIMITED"));
    const response = await processAiPost(new Request("http://localhost/api/diagnostics/process-ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caseId: "00000000-0000-4000-8000-000000000001" }),
    }));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.any(Request), "diagnostic_process_ai", 20, 15);
  });

  it("bloqueia envio final quando o limite estoura", async () => {
    enforceRateLimit.mockRejectedValueOnce(new ApiError(429, "Muitas tentativas.", "RATE_LIMITED"));
    const idempotencyKey = "00000000-0000-4000-8000-000000000010";
    const response = await sendPost(new Request("http://localhost/api/diagnostics/send", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({
        caseId: "00000000-0000-4000-8000-000000000001",
        reviewId: "00000000-0000-4000-8000-000000000002",
        subject: "Assunto válido",
        body: "Mensagem válida com tamanho mínimo para envio.",
        deliveryMethod: "secure_link",
        idempotencyKey,
      }),
    }));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.any(Request), "diagnostic_send_final", 20, 15);
  });

  it("bloqueia solicitação de informação quando o limite estoura", async () => {
    enforceRateLimit.mockRejectedValueOnce(new ApiError(429, "Muitas tentativas.", "RATE_LIMITED"));
    const idempotencyKey = "00000000-0000-4000-8000-000000000011";
    const response = await requestInformationPost(new Request("http://localhost/api/diagnostics/request-information", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({
        caseId: "00000000-0000-4000-8000-000000000001",
        subject: "Precisamos confirmar um ponto",
        message: "Por favor confirme os detalhes para seguirmos com segurança.",
        idempotencyKey,
      }),
    }));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(429);
    expect(body.code).toBe("RATE_LIMITED");
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.any(Request), "diagnostic_request_information", 30, 15);
  });
});
