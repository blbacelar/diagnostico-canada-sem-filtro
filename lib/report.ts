import { PDFDocument, PDFString, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { AiAssessment } from "./types";
import type { getAdminSupabase } from "./supabase";
import { ApiError } from "./api";
import { getCentralClientById } from "./central-client";
import { shouldIncludeMapaOfferForEmail } from "./purchase-window";

export const mapaCanadaOffer = {
  checkoutUrl: "https://pay.hotmart.com/L106380914K?off=m9qb9g7t",
  couponCode: "MAPA",
  discountLabel: "30% OFF",
} as const;

export type ReportData = {
  caseId: string; caseNumber: string; generatedAt: string; clientName: string; objective: string;
  includeMapaOffer?: boolean;
  assessment: AiAssessment;
  review: { coherent_path: string; assumptions_to_review: string; likely_mistakes: string; immediate_focus: string; study_strategy: string; validation_risks: string; next_steps: string[]; additional_notes: string; recommended_resources: string[]; version: number; approved_at: string };
};

export async function getReportData(admin: ReturnType<typeof getAdminSupabase>, caseId: string): Promise<ReportData> {
  const { data: diagnosticCase, error } = await admin.from("diagnostic_cases").select("id,case_number,objective,client_id,status").eq("id", caseId).single();
  if (error || !diagnosticCase) throw new ApiError(404, "Relatório não encontrado.");
  const [client, { data: assessment }, { data: review }] = await Promise.all([
    getCentralClientById(admin, diagnosticCase.client_id),
    admin.from("diagnostic_ai_assessments").select("structured_result").eq("case_id", caseId).eq("status", "completed").order("version", { ascending: false }).limit(1).maybeSingle(),
    admin.from("diagnostic_reviews").select("coherent_path,assumptions_to_review,likely_mistakes,immediate_focus,study_strategy,validation_risks,next_steps,additional_notes,recommended_resources,version,approved_at,status").eq("case_id", caseId).eq("status", "approved").order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!client || !assessment || !review) throw new ApiError(409, "O simulador ainda não possui um relatório aprovado.", "REPORT_NOT_APPROVED");
  const includeMapaOffer = await shouldIncludeMapaOfferForEmail(admin, client.email, client.id);
  return { caseId, caseNumber: diagnosticCase.case_number, generatedAt: new Date().toISOString(), clientName: client.name, objective: diagnosticCase.objective ?? "Projeto Canadá", includeMapaOffer, assessment: assessment.structured_result as AiAssessment, review: review as ReportData["review"] };
}

export async function generateReportPdf(report: ReportData) {
  const pdf = await PDFDocument.create();
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  const titleFont = await pdf.embedFont(StandardFonts.TimesRoman);
  const titleBoldFont = await pdf.embedFont(StandardFonts.TimesRomanBold);
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
      .replace(/\u00a0/g, " ")
      .replace(/[–—]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/…/g, "...")
      .replace(/→/g, "->")
      .replace(/←/g, "<-")
      .replace(/↔/g, "<->")
      .replace(/≥/g, ">=")
      .replace(/≤/g, "<=")
      .replace(/≠/g, "!=")
      .replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff]/g, "");

  const footerLabel = `${report.caseNumber}  |  Versão ${report.review.version}  |  ${new Date(report.generatedAt).toLocaleDateString("pt-BR")}`;
  const readinessLabel = {
    inicial: "Inicial",
    intermediario: "Intermediário",
    avancado: "Avançado",
  }[report.assessment.readinessLevel];

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

  function text(value: string, size = 10, font = bodyFont, color = ink, indent = 0, maxWidth = width - margin * 2 - indent) {
    const lineHeight = size * 1.45;
    const paragraphGap = 4;
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

  function heading(value: string, contentGap = 18, minimumContentHeight = 18) {
    const topGap = 14;
    const ruleOffset = 12;
    ensureSpace(topGap + ruleOffset + contentGap + minimumContentHeight + 20);
    y -= topGap;
    page.drawText(safe(value), {
      x: margin,
      y,
      size: 20,
      font: titleFont,
      color: ink,
    });
    const ruleY = y - ruleOffset;
    page.drawLine({
      start: { x: margin, y: ruleY },
      end: { x: width - margin, y: ruleY },
      thickness: 0.7,
      color: rule,
    });
    y = ruleY - contentGap;
  }

  function bullets(items: string[]) {
    for (const item of items) {
      ensureSpace(19);
      page.drawCircle({
        x: margin + 3,
        y: y + 3.5,
        size: 1.6,
        color: burgundy,
      });
      text(item, 10, bodyFont, ink, 14);
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
    page.drawText(safe(report.clientName), {
      x: titleX,
      y: titleBaseY - 122,
      size: 44,
      font: titleFont,
      color: ink,
    });
  }

  function addExternalLink(x: number, linkY: number, linkWidth: number, linkHeight: number, url: string) {
    const annotation = pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, linkY, x + linkWidth, linkY + linkHeight],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    });
    page.node.addAnnot(pdf.context.register(annotation));
  }

  async function drawMapaOfferPage() {
    newPage();
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.99, 0.982, 0.96) });

    const paper = rgb(1, 1, 1);
    const paleBurgundy = rgb(0.98, 0.9, 0.9);
    const leftX = margin;
    const paragraphWidth = 305;
    const qrCardX = 374;
    const qrCardY = 506;
    const qrCardWidth = 155;
    const qrCardHeight = 186;

    const paragraphAt = (value: string, x: number, startY: number, maxWidth: number, size: number, font = titleFont, color = ink, lineHeight = size * 1.28) => {
      const lines: string[] = [];
      let line = "";
      for (const word of safe(value).split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
      lines.forEach((lineText, index) => page.drawText(lineText, { x, y: startY - index * lineHeight, size, font, color }));
      return startY - lines.length * lineHeight;
    };

    const drawRule = (x: number, ruleY: number, ruleWidth: number) => page.drawLine({
      start: { x, y: ruleY }, end: { x: x + ruleWidth, y: ruleY }, thickness: 0.8, color: burgundy,
    });

    const drawCircleIcon = (centerX: number, centerY: number, type: "video" | "clipboard" | "community") => {
      page.drawCircle({ x: centerX, y: centerY, size: 28, color: paleBurgundy });
      if (type === "video") {
        page.drawRectangle({ x: centerX - 14, y: centerY - 9, width: 23, height: 18, color: burgundy });
        page.drawSvgPath("M 0 0 L 0 8 L 7 4 Z", { x: centerX - 5, y: centerY - 4, color: paper });
        page.drawRectangle({ x: centerX + 12, y: centerY - 12, width: 12, height: 21, borderColor: burgundy, borderWidth: 1.8 });
        page.drawLine({ start: { x: centerX + 15, y: centerY + 3 }, end: { x: centerX + 21, y: centerY + 3 }, thickness: 1, color: burgundy });
      } else if (type === "clipboard") {
        page.drawRectangle({ x: centerX - 13, y: centerY - 16, width: 26, height: 32, borderColor: burgundy, borderWidth: 2 });
        page.drawRectangle({ x: centerX - 6, y: centerY + 14, width: 12, height: 5, borderColor: burgundy, borderWidth: 1.7 });
        [-5, 2, 9].forEach((offset) => page.drawLine({ start: { x: centerX - 6, y: centerY + offset }, end: { x: centerX + 7, y: centerY + offset }, thickness: 1.2, color: burgundy }));
      } else {
        page.drawCircle({ x: centerX, y: centerY + 8, size: 7, color: burgundy });
        page.drawCircle({ x: centerX - 13, y: centerY + 4, size: 5, color: burgundy });
        page.drawCircle({ x: centerX + 13, y: centerY + 4, size: 5, color: burgundy });
        page.drawCircle({ x: centerX, y: centerY - 12, size: 13, color: burgundy });
        page.drawCircle({ x: centerX - 13, y: centerY - 10, size: 9, color: burgundy });
        page.drawCircle({ x: centerX + 13, y: centerY - 10, size: 9, color: burgundy });
      }
    };

    const qrDataUrl = await QRCode.toDataURL(mapaCanadaOffer.checkoutUrl, {
      width: 420, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0D2B52", light: "#FFFFFF" },
    });
    const qrCode = await pdf.embedPng(qrDataUrl);

    page.drawText("SEU PRÓXIMO PASSO", { x: leftX, y: 790, size: 8.6, font: bodyFont, color: burgundy });
    drawRule(204, 794, 42);
    page.drawText("Você já sabe onde está.", { x: leftX, y: 741, size: 31, font: titleBoldFont, color: ink });
    page.drawText("Agora é hora de traçar a rota.", { x: leftX, y: 706, size: 31, font: italicFont, color: burgundy });

    let bodyY = 662;
    bodyY = paragraphAt('Agora que você conhece os pontos fortes do seu perfil e o que ainda precisa ser desenvolvido, é natural se perguntar: "Tá, mas e agora? O que eu faço com isso? Por onde começo a estruturar o meu Projeto Canadá?"', leftX, bodyY, paragraphWidth, 10.8);
    bodyY -= 10;
    bodyY = paragraphAt("É exatamente para isso que existe o Meu Mapa Canadá: um sistema de orientação e planejamento que transforma tudo o que você descobriu aqui em um plano de verdade.", leftX, bodyY, paragraphWidth, 10.8);
    bodyY -= 10;
    paragraphAt("Como você já confiou na gente e adquiriu o Simulador, liberamos uma condição exclusiva para seguir estruturando o seu planejamento.", leftX, bodyY, paragraphWidth, 10.8);

    page.drawRectangle({ x: qrCardX + 3, y: qrCardY - 3, width: qrCardWidth, height: qrCardHeight, color: rgb(0.85, 0.85, 0.85), opacity: 0.25 });
    page.drawRectangle({ x: qrCardX, y: qrCardY, width: qrCardWidth, height: qrCardHeight, color: paper, borderColor: rgb(0.93, 0.92, 0.9), borderWidth: 0.8 });
    const qrSize = 112;
    page.drawImage(qrCode, { x: qrCardX + (qrCardWidth - qrSize) / 2, y: qrCardY + 70, width: qrSize, height: qrSize });
    page.drawLine({ start: { x: qrCardX + 18, y: qrCardY + 60 }, end: { x: qrCardX + qrCardWidth - 18, y: qrCardY + 60 }, thickness: 0.7, color: muted });
    page.drawCircle({ x: qrCardX + 27, y: qrCardY + 34, size: 13, color: burgundy });
    page.drawRectangle({ x: qrCardX + 19, y: qrCardY + 28, width: 16, height: 11, borderColor: paper, borderWidth: 1.5 });
    page.drawCircle({ x: qrCardX + 27, y: qrCardY + 33.5, size: 2.7, borderColor: paper, borderWidth: 1.2 });
    page.drawText("Aponte a câmera", { x: qrCardX + 48, y: qrCardY + 39, size: 8.3, font: bodyFont, color: ink });
    page.drawText("para resgatar", { x: qrCardX + 48, y: qrCardY + 26, size: 8.3, font: bodyFont, color: ink });
    page.drawText("seu presente.", { x: qrCardX + 48, y: qrCardY + 13, size: 8.3, font: bodyFont, color: ink });
    addExternalLink(qrCardX, qrCardY, qrCardWidth, qrCardHeight, mapaCanadaOffer.checkoutUrl);

    page.drawText("O que você recebe", { x: leftX, y: 462, size: 25, font: titleBoldFont, color: ink });
    drawRule(287, 469, 54);

    const benefits = [
      { number: "1.", type: "video" as const, title: "Videoaulas e e-book para conhecer o Canadá real:", description: "trabalho, custo de vida, moradia, família, idioma, adaptação emocional e caminhos de imigração, sem romantização e sem terrorismo.", y: 413 },
      { number: "2.", type: "clipboard" as const, title: "Diário de Bordo:", description: "app de planejamento em sete etapas, com estimativa de custos, acompanhamento de progresso e fontes oficiais reunidas.", y: 325 },
      { number: "3.", type: "community" as const, title: "Comunidade no WhatsApp", description: "para atualizações, dúvidas e troca de experiências com pessoas na mesma jornada.", y: 238 },
    ];
    for (const benefit of benefits) {
      drawCircleIcon(83, benefit.y - 6, benefit.type);
      page.drawText(benefit.number, { x: 138, y: benefit.y + 3, size: 18, font: titleBoldFont, color: burgundy });
      page.drawText(benefit.title, { x: 167, y: benefit.y + 7, size: 10.5, font: titleBoldFont, color: ink });
      paragraphAt(benefit.description, 167, benefit.y - 9, 362, 10.1, titleFont, ink, 12.5);
    }

    drawRule(leftX, 186, width - margin * 2);
    page.drawText("O resultado:", { x: leftX, y: 161, size: 11.8, font: titleBoldFont, color: ink });
    paragraphAt('você deixa de se perguntar "será que estou fazendo certo?" e passa a saber o que precisa avaliar, organizar e priorizar antes de tomar decisões maiores.', 126, 161, 405, 10.5, titleFont, ink, 13);

    const giftY = 45;
    const giftWidth = width - margin * 2;
    page.drawRectangle({ x: leftX, y: giftY, width: giftWidth, height: 92, color: burgundy });
    page.drawLine({ start: { x: 165, y: giftY + 12 }, end: { x: 165, y: giftY + 80 }, thickness: 1, color: paper });
    page.drawRectangle({ x: 97, y: giftY + 27, width: 42, height: 35, borderColor: paper, borderWidth: 2 });
    page.drawLine({ start: { x: 118, y: giftY + 27 }, end: { x: 118, y: giftY + 62 }, thickness: 2, color: paper });
    page.drawLine({ start: { x: 97, y: giftY + 47 }, end: { x: 139, y: giftY + 47 }, thickness: 2, color: paper });
    page.drawCircle({ x: 109, y: giftY + 69, size: 8, borderColor: paper, borderWidth: 2 });
    page.drawCircle({ x: 127, y: giftY + 69, size: 8, borderColor: paper, borderWidth: 2 });
    page.drawText("SEU PRESENTE:", { x: 191, y: giftY + 63, size: 12, font: bodyFont, color: paper });
    page.drawText(mapaCanadaOffer.discountLabel, { x: 299, y: giftY + 58, size: 24, font: bodyFont, color: paper });
    page.drawText("no Meu Mapa Canadá", { x: 191, y: giftY + 36, size: 20, font: titleFont, color: paper });
    page.drawRectangle({ x: 191, y: giftY + 10, width: 270, height: 22, color: paper });
    page.drawText("Digite o cupom", { x: 207, y: giftY + 16, size: 9.5, font: bodyFont, color: ink });
    page.drawText(mapaCanadaOffer.couponCode, { x: 291, y: giftY + 15, size: 12, font: bodyFont, color: burgundy });
    page.drawText("no checkout.", { x: 338, y: giftY + 16, size: 9.5, font: bodyFont, color: ink });
    addExternalLink(leftX, giftY, giftWidth, 92, mapaCanadaOffer.checkoutUrl);
  }

  drawCoverPage();

  newPage();
  heading("Resumo do perfil");
  text(report.objective, 12, titleFont);
  text(report.assessment.executiveSummary);

  heading("Nível de preparo", 30, 42);
  text(`${report.assessment.overallScore}/100 - ${readinessLabel}`, 24, titleFont, burgundy);
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

  heading("Estudar no Canadá como estratégia");
  text(report.review.study_strategy);

  heading("Próximos passos");
  bullets(report.review.next_steps);

  heading("Validação profissional");
  text(report.review.validation_risks);

  if (report.review.additional_notes) {
    heading("Observações adicionais");
    text(report.review.additional_notes);
  }

  if (report.includeMapaOffer) await drawMapaOfferPage();

  return pdf.save();
}
