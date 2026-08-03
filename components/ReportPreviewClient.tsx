"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReportData } from "../lib/report";
import { DashboardError, DashboardLoading } from "./DashboardData";
import { detailFetch, type CaseDetailData } from "./DiagnosticDetail";
import { ReportDocument } from "./ReportDocument";

type Review = ReportData["review"] & { status: string };

export function ReportPreviewClient({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<CaseDetailData | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      detailFetch<CaseDetailData>(`/api/dashboard/cases/${caseId}`),
      detailFetch<{ review: Review | null }>(`/api/diagnostics/reviews?caseId=${caseId}`),
    ]).then(([caseDetail, reviewData]) => {
      setDetail(caseDetail);
      setReview(reviewData.review);
    }).catch(() => setError(true));
  }, [caseId]);

  if (error) return <DashboardError />;
  if (!detail) return <DashboardLoading />;
  if (!detail.assessment || !review) {
    return <div className="module-empty">
      <h2>O relatório ainda não pode ser montado</h2>
      <p>Conclua a análise automática e salve o parecer profissional para liberar esta pré-visualização.</p>
      <Link className="primary-button" href={`/dashboard/diagnosticos/${caseId}/parecer`}>Abrir parecer</Link>
    </div>;
  }

  const report: ReportData = {
    caseId,
    caseNumber: detail.case.case_number,
    generatedAt: new Date().toISOString(),
    clientName: detail.client.full_name,
    objective: detail.case.objective ?? "Projeto Canadá",
    assessment: detail.assessment.structured_result,
    review: { ...review, approved_at: review.approved_at ?? "" },
  };

  return <>
    <div className="detail-back">
      <Link href={`/dashboard/diagnosticos/${caseId}`}><ArrowLeft /> Voltar ao caso</Link>
      <span>{review.status === "approved" ? "Versão aprovada" : "Rascunho — não enviar"}</span>
    </div>
    <ReportDocument report={report} preview />
  </>;
}
