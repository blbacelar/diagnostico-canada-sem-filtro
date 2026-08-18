import { describe, expect, it, vi } from "vitest";

const { requireConsultant, claimCaseForReview } = vi.hoisted(() => ({
  requireConsultant: vi.fn(),
  claimCaseForReview: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api")>(),
  enforceRateLimit: vi.fn(),
  requireConsultant,
}));
vi.mock("../../lib/case-lock", () => ({ claimCaseForReview }));

import { POST } from "../../app/api/diagnostics/send/route";

describe("API de entrega concluída", () => {
  it("não reenvia um diagnóstico que já está enviado", async () => {
    const deliveriesQuery = {
      select: vi.fn(() => deliveriesQuery),
      eq: vi.fn(() => deliveriesQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const reviewsQuery = {
      select: vi.fn(() => reviewsQuery),
      eq: vi.fn(() => reviewsQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "00000000-0000-4000-8000-000000000002", status: "approved" }, error: null }),
    };
    const operationalSettingsQuery = {
      select: vi.fn(() => operationalSettingsQuery),
      eq: vi.fn(() => operationalSettingsQuery),
      single: vi.fn().mockResolvedValue({
        data: {
          policy_version: "1.0.0",
          methodology_version: "1.0.0",
          prompt_version: "1.0.0",
          model: "openai/gpt-5.4",
          form_link_days: 30,
          report_link_days: 30,
          review_sla_hours: 48,
        },
        error: null,
      }),
    };
    const casesQuery = {
      select: vi.fn(() => casesQuery),
      eq: vi.fn(() => casesQuery),
      single: vi.fn().mockResolvedValue({
        data: { id: "00000000-0000-4000-8000-000000000001", case_number: "DCF-001", status: "sent", client_id: "client-1" },
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "00000000-0000-4000-8000-000000000001", case_number: "DCF-001", status: "sent", client_id: "client-1" },
        error: null,
      }),
    };
    const clientsQuery = {
      select: vi.fn(() => clientsQuery),
      eq: vi.fn(() => clientsQuery),
      single: vi.fn().mockResolvedValue({
        data: { name: "Cliente Teste", email: "cliente@example.com" },
        error: null,
      }),
    };
    const allowedEmailsQuery = {
      select: vi.fn(() => allowedEmailsQuery),
      eq: vi.fn(() => allowedEmailsQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { email: "cliente@example.com", last_event: "purchase", last_event_at: new Date().toISOString() },
        error: null,
      }),
    };
    const rateLimitsQuery = {
      select: vi.fn(() => rateLimitsQuery),
      eq: vi.fn(() => rateLimitsQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    const from = vi.fn((table: string) => {
      if (table === "diagnostic_reviews") return reviewsQuery;
      if (table === "diagnostic_operational_settings") return operationalSettingsQuery;
      if (table === "diagnostic_cases") return casesQuery;
      if (table === "clients") return clientsQuery;
      if (table === "allowed_emails") return allowedEmailsQuery;
      if (table === "diagnostic_rate_limits") return rateLimitsQuery;
      return deliveriesQuery;
    });
    requireConsultant.mockResolvedValue({ admin: { from }, user: { id: "consultant-1" } });
    claimCaseForReview.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", status: "sent" });
    const idempotencyKey = "00000000-0000-4000-8000-000000000003";
    const response = await POST(new Request("http://localhost/api/diagnostics/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        caseId: "00000000-0000-4000-8000-000000000001",
        reviewId: "00000000-0000-4000-8000-000000000002",
        subject: "Simulador concluído",
        body: "O resultado do seu simulador está pronto para consulta.",
        deliveryMethod: "secure_link",
        idempotencyKey,
      }),
    }));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe("ALREADY_DELIVERED");
  });
});
