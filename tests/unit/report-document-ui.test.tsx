// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReportData } from "../../lib/report";
import { ReportDocument } from "../../components/ReportDocument";

const report = {
  caseId: "case-1",
  caseNumber: "DCF-001",
  generatedAt: "2026-08-03T19:00:00Z",
  clientName: "Ana Silva",
  objective: "Projeto Canadá",
  assessment: {
    overallScore: 68,
    readinessLevel: "intermediario",
    scoreExplanation: "Há uma base de preparação.",
    executiveSummary: "Resumo do perfil.",
    strengths: ["Experiência profissional"],
    risks: ["Planejamento financeiro"],
    missingOrContradictory: [],
    technicalAlerts: ["Validação profissional necessária"],
    priorities: { threeMonths: ["Prioridade inicial"], sixMonths: ["Prioridade intermediária"], twelveMonths: ["Prioridade futura"] },
    scoreComponents: [],
    regionalCompatibility: [],
    cityTypes: [],
    initialInvestmentRange: "R$ 300.000",
    recommendedReserve: "Reserva recomendada",
    preparationTimeEstimate: "12 meses",
    recommendedContent: [],
    followUpQuestions: [],
    confidence: 0.9,
    methodologyVersion: "1.0.0",
    promptVersion: "1.0.0",
    model: "openai/gpt-5.4",
  },
  review: {
    coherent_path: "Caminho coerente.", assumptions_to_review: "Premissas.", likely_mistakes: "Erros.", immediate_focus: "Foco.", study_strategy: "Estratégia.", validation_risks: "Validação.", next_steps: ["Primeiro passo"], additional_notes: "", recommended_resources: [], version: 1, approved_at: "2026-08-03T19:00:00Z",
  },
} as ReportData;

afterEach(() => cleanup());

describe("relatório para impressão", () => {
  it("abre o diálogo de impressão pelo botão Imprimir", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<ReportDocument report={report} preview={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));

    expect(print).toHaveBeenCalledOnce();
    expect(screen.queryByText("Use imprimir para exportar PDF")).toBeNull();
    print.mockRestore();
  });
});
