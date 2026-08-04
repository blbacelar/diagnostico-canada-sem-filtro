import { handleApiError, requireConsultant } from "../../../../../lib/api";
import { generateReportPdf, getReportData } from "../../../../../lib/report";
import { claimCaseForReview } from "../../../../../lib/case-lock";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const{id}=await params;const{admin,user}=await requireConsultant(request);await claimCaseForReview(admin,id,user.id);const report=await getReportData(admin,id);const pdf=await generateReportPdf(report);return new Response(pdf as BodyInit,{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${report.caseNumber}.pdf"`,"Cache-Control":"private, no-store"}});}catch(error){return handleApiError(error);}}
