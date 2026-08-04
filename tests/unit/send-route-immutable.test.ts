import { describe, expect, it, vi } from "vitest";

const { requireConsultant, claimCaseForReview } = vi.hoisted(() => ({
  requireConsultant: vi.fn(),
  claimCaseForReview: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api")>(),
  requireConsultant,
}));
vi.mock("../../lib/case-lock", () => ({ claimCaseForReview }));

import { POST } from "../../app/api/diagnostics/send/route";

describe("API de entrega concluída", () => {
  it("não reenvia um diagnóstico que já está enviado", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    requireConsultant.mockResolvedValue({ admin: { from: vi.fn(() => query) }, user: { id: "consultant-1" } });
    claimCaseForReview.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", status: "sent" });
    const idempotencyKey = "00000000-0000-4000-8000-000000000003";
    const response = await POST(new Request("http://localhost/api/diagnostics/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        caseId: "00000000-0000-4000-8000-000000000001",
        reviewId: "00000000-0000-4000-8000-000000000002",
        subject: "Diagnóstico concluído",
        body: "Seu diagnóstico está pronto para consulta.",
        deliveryMethod: "secure_link",
        idempotencyKey,
      }),
    }));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe("ALREADY_DELIVERED");
  });
});
