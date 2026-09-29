import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";
import { generateReportPdf, mapaCanadaOffer, type ReportData } from "../../lib/report";

function reportWithText(text: string): ReportData {
  return {
    caseId: "case-1",
    caseNumber: "CSF-2026-TESTE",
    generatedAt: "2026-09-14T18:00:00.000Z",
    clientName: "Cliente Teste 😊",
    objective: "ocupação-alvo → estratégia migratória",
    includeMapaOffer: false,
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

  it("inclui uma última página com QR Code e link clicável para quem comprou somente o Simulador", async () => {
    const pdf = await generateReportPdf({
      ...reportWithText("Texto curto para validar a oferta."),
      includeMapaOffer: true,
    });
    const document = await PDFDocument.load(pdf);
    const lastPage = document.getPages().at(-1);
    const annotations = lastPage?.node.Annots();
    const linkAnnotation = annotations && document.context.lookup(annotations.get(0), PDFDict);
    const action = linkAnnotation?.lookup(PDFName.of("A"), PDFDict);
    const uri = action?.lookup(PDFName.of("URI"), PDFString);

    expect(document.getPageCount()).toBeGreaterThan(2);
    expect(annotations?.size()).toBeGreaterThan(0);
    expect(uri?.decodeText()).toBe(mapaCanadaOffer.checkoutUrl);
  });

  it("não inclui a oferta quando o relatório não é elegível", async () => {
    const pdf = await generateReportPdf(reportWithText("Sem oferta."));

    expect(Buffer.from(pdf).toString("latin1")).not.toContain(mapaCanadaOffer.checkoutUrl);
  });
});
