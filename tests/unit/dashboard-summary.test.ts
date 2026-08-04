import { describe, expect, it } from "vitest";
import { buildDashboardSummary } from "../../lib/dashboard-summary";

const assessmentWithAlert = [{ version: 1, structured_result: { technicalAlerts: ["Validar documentação"] } }];

describe("resumo operacional do dashboard", () => {
  it("agrupa todos os estados do funil em indicadores compreensíveis", () => {
    const result = buildDashboardSummary([
      { status: "submitted" },
      { status: "ai_processing" },
      { status: "awaiting_triage" },
      { status: "in_review" },
      { status: "awaiting_client" },
      { status: "ready_for_approval" },
      { status: "approved" },
      { status: "sending" },
      { status: "sent" },
    ]);

    expect(result.counts).toMatchObject({ new_cases: 3, in_review: 3, ready_to_send: 2, delivered: 1 });
    expect(result.recent.map((item) => item.status)).toEqual(["submitted", "ai_processing", "awaiting_triage"]);
  });

  it("não conta alerta técnico de diagnóstico já entregue", () => {
    const result = buildDashboardSummary([
      { status: "awaiting_triage", diagnostic_ai_assessments: assessmentWithAlert },
      { status: "sent", diagnostic_ai_assessments: assessmentWithAlert },
    ]);

    expect(result.counts.technical_attention).toBe(1);
    expect(result.counts.delivered).toBe(1);
  });

  it("usa somente a análise mais recente para atenção técnica", () => {
    const result = buildDashboardSummary([{ status: "in_review", diagnostic_ai_assessments: [
      { version: 1, structured_result: { technicalAlerts: ["Antigo"] } },
      { version: 2, structured_result: { technicalAlerts: [] } },
    ] }]);

    expect(result.counts.technical_attention).toBe(0);
  });
});
