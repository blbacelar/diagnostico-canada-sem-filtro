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
    admin.from("diagnostic_clients").select("full_name").eq("id", diagnosticCase.client_id).single(),
    admin.from("diagnostic_ai_assessments").select("structured_result").eq("case_id", caseId).eq("status", "completed").order("version", { ascending: false }).limit(1).maybeSingle(),
    admin.from("diagnostic_reviews").select("coherent_path,assumptions_to_review,likely_mistakes,immediate_focus,study_strategy,validation_risks,next_steps,additional_notes,recommended_resources,version,approved_at,status").eq("case_id", caseId).eq("status", "approved").order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!client || !assessment || !review) throw new ApiError(409, "O diagnóstico ainda não possui um relatório aprovado.", "REPORT_NOT_APPROVED");
  return { caseId, caseNumber: diagnosticCase.case_number, generatedAt: new Date().toISOString(), clientName: client.full_name, objective: diagnosticCase.objective ?? "Projeto Canadá", assessment: assessment.structured_result as AiAssessment, review: review as ReportData["review"] };
}

export async function generateReportPdf(report: ReportData) {
  const pdf = await PDFDocument.create(); const bodyFont = await pdf.embedFont(StandardFonts.Helvetica); const titleFont = await pdf.embedFont(StandardFonts.TimesRoman); const italicFont = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const width = 595.28, height = 841.89, margin = 55; let page = pdf.addPage([width,height]); let y = height - margin;
  const burgundy = rgb(0.718,0.11,0.239), ink = rgb(0.09,0.13,0.17), muted = rgb(0.32,0.4,0.45), rule = rgb(0.81,0.87,0.89);
  const safe = (value:string) => value.replace(/[–—]/g,"-").replace(/[“”]/g,'"').replace(/[‘’]/g,"'");
  function newPage(){page=pdf.addPage([width,height]);y=height-margin;footer();}
  function footer(){page.drawLine({start:{x:margin,y:32},end:{x:width-margin,y:32},thickness:.5,color:rule});page.drawText(`${report.caseNumber}  |  Versao ${report.review.version}  |  ${new Date(report.generatedAt).toLocaleDateString("pt-BR")}`,{x:margin,y:18,size:7,font:bodyFont,color:muted});}
  function text(value:string,size=10,font=bodyFont,color=ink,indent=0){const maxWidth=width-margin*2-indent;const words=safe(value).split(/\s+/);let line="";for(const word of words){const next=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(next,size)>maxWidth){if(y<size*1.5)newPage();page.drawText(line,{x:margin+indent,y,size,font,color});y-=size*1.5;line=word;}else line=next;}if(line){if(y<size*1.5)newPage();page.drawText(line,{x:margin+indent,y,size,font,color});y-=size*1.5;}y-=4;}
  function heading(value:string){if(y<100)newPage();y-=10;text(value,20,titleFont,ink);page.drawLine({start:{x:margin,y:y+2},end:{x:width-margin,y:y+2},thickness:.7,color:rule});y-=12;}
  function bullets(items:string[]){items.forEach(item=>text(`• ${item}`,10,bodyFont,ink,8));}
  footer(); page.drawText("CANADA SEM FILTRO",{x:margin,y,size:8,font:bodyFont,color:burgundy}); y-=68; text("Diagnostico",42,titleFont,ink); text("profissional",42,italicFont,burgundy); y-=25; text(report.clientName,21,titleFont,ink); text(`${report.caseNumber}  |  ${new Date(report.generatedAt).toLocaleDateString("pt-BR")}`,8,bodyFont,muted); y-=50; text("Conteudo educacional e de planejamento. Este relatorio nao representa promessa de elegibilidade, aprovacao migratoria ou aconselhamento juridico definitivo.",11,italicFont,muted); newPage();
  heading("Resumo do perfil"); text(report.objective,12,titleFont); text(report.assessment.executiveSummary);
  heading("Nivel de preparo"); text(`${report.assessment.overallScore}/100 - ${report.assessment.readinessLevel}`,24,titleFont,burgundy); text(report.assessment.scoreExplanation);
  heading("Pontos fortes"); bullets(report.assessment.strengths);
  heading("Riscos e alertas"); bullets(report.assessment.risks); bullets(report.assessment.technicalAlerts);
  heading("Prioridades para 3, 6 e 12 meses"); text("3 meses",12,titleFont,burgundy);bullets(report.assessment.priorities.threeMonths);text("6 meses",12,titleFont,burgundy);bullets(report.assessment.priorities.sixMonths);text("12 meses",12,titleFont,burgundy);bullets(report.assessment.priorities.twelveMonths);
  heading("Parecer personalizado"); text(report.review.coherent_path); heading("Premissas a revisar");text(report.review.assumptions_to_review);heading("Foco imediato");text(report.review.immediate_focus);heading("Estudar no Canada como estrategia");text(report.review.study_strategy);heading("Proximos passos");bullets(report.review.next_steps);heading("Validacao profissional");text(report.review.validation_risks);if(report.review.additional_notes){heading("Observacoes adicionais");text(report.review.additional_notes);}return pdf.save();
}
