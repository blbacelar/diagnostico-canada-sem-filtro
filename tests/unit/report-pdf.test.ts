import { describe, expect, it } from "vitest";
import { generateReportPdf, type ReportData } from "../../lib/report";

function reportWithText(text: string): ReportData {
  return {
    caseId: "case-1",
    caseNumber: "CSF-2026-TESTE",
    generatedAt: "2026-09-14T18:00:00.000Z",
    clientName: "Cliente Teste 😊",
    objective: "ocupação-alvo → estratégia migratória",
    assessment: {
      executiveSummary: text,
      overallScore: 68,
      readinessLevel: "intermediario",
      scoreExplanation: text,
      strengths: [text],
      risks: [text],
      technicalAlerts: [text],
      priorities: {
        threeMonths: [text],
        sixMonths: [text],
        twelveMonths: [text],
      },
      scoreComponents: [],
      missingOrContradictory: [],
      regionalCompatibility: [],
      cityTypes: [],
      initialInvestmentRange: text,
      recommendedReserve: text,
      preparationTimeEstimate: text,
      recommendedContent: [],
      followUpQuestions: [],
      confidence: 0.8,
      methodologyVersion: "test",
      promptVersion: "test",
      model: "test",
    },
    review: {
      coherent_path: text,
      assumptions_to_review: text,
      likely_mistakes: text,
      immediate_focus: text,
      study_strategy: text,
      validation_risks: text,
      next_steps: [text],
      additional_notes: text,
      recommended_resources: [],
      version: 1,
      approved_at: "2026-09-14T18:00:00.000Z",
    },
  };
}

describe("PDF do relatório", () => {
  it("gera PDF mesmo com setas e símbolos colados no parecer", async () => {
    const pdf = await generateReportPdf(
      reportWithText("Sequência recomendada: ocupação-alvo → lacunas → idiomas ≥ meta mínima."),
    );

    expect(pdf.byteLength).toBeGreaterThan(1000);
  });
});
