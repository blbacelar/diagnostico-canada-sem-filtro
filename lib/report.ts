import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AiAssessment } from "./types";
import type { getAdminSupabase } from "./supabase";
import { ApiError } from "./api";

export type ReportData = {
  caseId: string; caseNumber: string; generatedAt: string; clientName: string; objective: string;
  assessment: AiAssessment;
  review: { coherent_path: string; assumptions_to_review: string; likely_mistakes: string; immediate_focus: string; study_strategy: string; validation_risks: string; next_steps: string[]; additional_notes: string; recommended_resources: string[]; version: number; approved_at: string };
};

export async function getReportData(admin: ReturnType<typeof getAdminSupabase>, caseId: string): Promise<ReportData> {
  const { data: diagnosticCase, error } = await admin.from("diagnostic_cases").select("id,case_number,objective,client_id,status").eq("id", caseId).single();
  if (error || !diagnosticCase) throw new ApiError(404, "Relatório não encontrado.");
  const [{ data: client }, { data: assessment }, { data: review }] = await Promise.all([
    admin.from("clients").select("name").eq("id", diagnosticCase.client_id).single(),
    admin.from("diagnostic_ai_assessments").select("structured_result").eq("case_id", caseId).eq("status", "completed").order("version", { ascending: false }).limit(1).maybeSingle(),
    admin.from("diagnostic_reviews").select("coherent_path,assumptions_to_review,likely_mistakes,immediate_focus,study_strategy,validation_risks,next_steps,additional_notes,recommended_resources,version,approved_at,status").eq("case_id", caseId).eq("status", "approved").order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!client || !assessment || !review) throw new ApiError(409, "O simulador ainda não possui um relatório aprovado.", "REPORT_NOT_APPROVED");
  return { caseId, caseNumber: diagnosticCase.case_number, generatedAt: new Date().toISOString(), clientName: client.name, objective: diagnosticCase.objective ?? "Projeto Canadá", assessment: assessment.structured_result as AiAssessment, review: review as ReportData["review"] };
}

export async function generateReportPdf(report: ReportData) {
  const pdf = await PDFDocument.create();
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  const titleFont = await pdf.embedFont(StandardFonts.TimesRoman);
  const italicFont = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const width = 595.28;
  const height = 841.89;
  const margin = 55;
  const footerRuleY = 32;
  const footerTextY = 18;
  const contentBottomY = 74;

  let page = pdf.addPage([width, height]);
  let y = height - margin;

  const burgundy = rgb(0.718, 0.11, 0.239);
  const ink = rgb(0.09, 0.13, 0.17);
  const muted = rgb(0.32, 0.4, 0.45);
  const rule = rgb(0.81, 0.87, 0.89);

  const safe = (value: string) =>
    value
      .replace(/[–—]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");

  const footerLabel = `${report.caseNumber}  |  Versao ${report.review.version}  |  ${new Date(report.generatedAt).toLocaleDateString("pt-BR")}`;

  function footer() {
    page.drawLine({
      start: { x: margin, y: footerRuleY },
      end: { x: width - margin, y: footerRuleY },
      thickness: 0.5,
      color: rule,
    });
    page.drawText(footerLabel, {
      x: margin,
      y: footerTextY,
      size: 7,
      font: bodyFont,
      color: muted,
    });
  }

  function newPage() {
    page = pdf.addPage([width, height]);
    y = height - margin;
    footer();
  }

  function ensureSpace(requiredHeight: number) {
    if (y - requiredHeight < contentBottomY) {
      newPage();
    }
  }

  function text(value: string, size = 10, font = bodyFont, color = ink, indent = 0) {
    const lineHeight = size * 1.45;
    const paragraphGap = 4;
    const maxWidth = width - margin * 2 - indent;
    const words = safe(value).split(/\s+/);

    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth) {
        ensureSpace(lineHeight + paragraphGap);
        page.drawText(line, { x: margin + indent, y, size, font, color });
        y -= lineHeight;
        line = word;
      } else {
        line = next;
      }
    }

    if (line) {
      ensureSpace(lineHeight + paragraphGap);
      page.drawText(line, { x: margin + indent, y, size, font, color });
      y -= lineHeight;
    }

    y -= paragraphGap;
  }

  function heading(value: string) {
    ensureSpace(56);
    y -= 10;
    text(value, 20, titleFont, ink);
    ensureSpace(16);
    page.drawLine({
      start: { x: margin, y: y + 2 },
      end: { x: width - margin, y: y + 2 },
      thickness: 0.7,
      color: rule,
    });
    y -= 12;
  }

  function bullets(items: string[]) {
    for (const item of items) {
      text(`• ${item}`, 10, bodyFont, ink, 8);
    }
  }

  function drawCoverPage() {
    // Subtle paper tone used in preview cover.
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.965, 0.98, 0.985),
    });

    footer();

    const logoX = margin + 16;
    const logoTopY = height - 88;
    page.drawText("Canadá", { x: logoX, y: logoTopY, size: 34, font: titleFont, color: ink });
    page.drawText("sem filtro", { x: logoX, y: logoTopY - 26, size: 27, font: italicFont, color: burgundy });
    page.drawText("SIMULADOR PROFISSIONAL", {
      x: logoX,
      y: logoTopY - 48,
      size: 7,
      font: bodyFont,
      color: muted,
    });

    const lineX = margin;
    page.drawLine({
      start: { x: lineX, y: height - 145 },
      end: { x: lineX, y: 88 },
      thickness: 1,
      color: burgundy,
    });

    const titleX = margin + 34;
    const titleBaseY = 420;
    page.drawText("RELATÓRIO INDIVIDUAL", {
      x: titleX,
      y: titleBaseY + 56,
      size: 8,
      font: bodyFont,
      color: burgundy,
    });
    page.drawText("Seu projeto", {
      x: titleX,
      y: titleBaseY,
      size: 76,
      font: titleFont,
      color: ink,
    });
    page.drawText("Canadá.", {
      x: titleX,
      y: titleBaseY - 52,
      size: 74,
      font: italicFont,
      color: burgundy,
    });
    page.drawText(report.clientName, {
      x: titleX,
      y: titleBaseY - 122,
      size: 44,
      font: titleFont,
      color: ink,
    });
  }

  drawCoverPage();

  newPage();
  heading("Resumo do perfil");
  text(report.objective, 12, titleFont);
  text(report.assessment.executiveSummary);

  heading("Nivel de preparo");
  text(`${report.assessment.overallScore}/100 - ${report.assessment.readinessLevel}`, 24, titleFont, burgundy);
  text(report.assessment.scoreExplanation);

  heading("Pontos fortes");
  bullets(report.assessment.strengths);

  heading("Riscos e alertas");
  bullets(report.assessment.risks);
  bullets(report.assessment.technicalAlerts);

  heading("Prioridades para 3, 6 e 12 meses");
  text("3 meses", 12, titleFont, burgundy);
  bullets(report.assessment.priorities.threeMonths);
  text("6 meses", 12, titleFont, burgundy);
  bullets(report.assessment.priorities.sixMonths);
  text("12 meses", 12, titleFont, burgundy);
  bullets(report.assessment.priorities.twelveMonths);

  heading("Parecer personalizado");
  text(report.review.coherent_path);

  heading("Premissas a revisar");
  text(report.review.assumptions_to_review);

  heading("Foco imediato");
  text(report.review.immediate_focus);

  heading("Estudar no Canada como estrategia");
  text(report.review.study_strategy);

  heading("Proximos passos");
  bullets(report.review.next_steps);

  heading("Validacao profissional");
  text(report.review.validation_risks);

  if (report.review.additional_notes) {
    heading("Observacoes adicionais");
    text(report.review.additional_notes);
  }

  return pdf.save();
}
