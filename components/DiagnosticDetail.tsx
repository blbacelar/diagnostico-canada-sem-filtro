"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Generic JSON helper supports multiple API contracts. */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Brain,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Eye,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";
import { diagnosticSections } from "../lib/questions";
import type { AiAssessment, FormAnswers } from "../lib/types";
import { getBrowserSupabase } from "../lib/supabase";
import { getCaseStatusLabel, getReviewStatusLabel } from "../lib/status-labels";
import { DashboardError, DashboardLoading } from "./DashboardData";
import { Button } from "./ui/button";

export type CaseDetailData = {
  case: {
    id: string;
    case_number: string;
    status: string;
    objective: string | null;
    submitted_at: string | null;
    updated_at: string;
    assigned_consultant_id: string | null;
  };
  client: { full_name: string; email_display: string };
  answers: FormAnswers;
  assessment: {
    id: string;
    version: number;
    structured_result: AiAssessment;
    created_at: string;
  } | null;
  review: { id: string; version: number; status: string; updated_at: string } | null;
  history: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    note: string | null;
    created_at: string;
  }>;
  delivery_window?: {
    purchase_date: string | null;
    purchase_event: string | null;
    days_since_purchase: number | null;
    days_remaining: number | null;
    eligible_to_send: boolean;
    message: string;
  };
};

export async function detailFetch<T = any>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { data } = await getBrowserSupabase().auth.getSession();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(result.error ?? "Falha na operação.");
  }
  return result;
}

export function DiagnosticDetailClient({ caseId }: { caseId: string }) {
  const [data, setData] = useState<CaseDetailData | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    detailFetch<CaseDetailData>(`/api/dashboard/cases/${caseId}`)
      .then(setData)
      .catch((fetchError) => {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Não foi possível abrir o diagnóstico.",
        );
      });
  }, [caseId]);

  if (error) {
    return <DashboardError title="Diagnóstico indisponível" detail={error} />;
  }

  if (!data) {
    return <DashboardLoading />;
  }

  const ai = data.assessment?.structured_result;
  const delivered = data.case.status === "sent";
  const approved = data.case.status === "approved";
  const sending = data.case.status === "sending";

  async function createReassessment() {
    setCreating(true);
    setActionError("");
    try {
      const result = await detailFetch<{ editUrl: string }>(
        `/api/dashboard/cases/${caseId}/reassessment`,
        { method: "POST" },
      );
      window.location.assign(result.editUrl);
    } catch (creationError) {
      setActionError(
        creationError instanceof Error
          ? creationError.message
          : "Não foi possível criar o novo diagnóstico.",
      );
      setCreating(false);
    }
  }

  return (
    <>
      <div className="detail-back">
        <Link href="/dashboard/diagnosticos">
          <ArrowLeft /> Diagnósticos
        </Link>
        <span>{data.case.case_number}</span>
      </div>

      <header className="detail-heading">
        <div>
          <p className="eyebrow">{delivered ? "Diagnóstico enviado" : "Caso em análise"}</p>
          <h1>{data.client.full_name}</h1>
          <p>
            {data.client.email_display} · {data.case.objective ?? "Objetivo não definido"}
          </p>
        </div>

        <div className="detail-action-group">
          <div className="detail-actions">
            {delivered ? (
              <>
                <Link
                  className="secondary-button"
                  href={`/dashboard/diagnosticos/${caseId}/parecer`}
                >
                  <Pencil /> Editar parecer
                </Link>
                <Link
                  className="secondary-button"
                  href={`/dashboard/diagnosticos/${caseId}/relatorio`}
                >
                  <Eye /> Ver diagnóstico enviado
                </Link>
                <Button type="button" onClick={createReassessment} disabled={creating}>
                  <Plus /> {creating ? "Preparando…" : "Novo diagnóstico"}
                </Button>
              </>
            ) : approved ? (
              <>
                <Link
                  className="secondary-button"
                  href={`/dashboard/diagnosticos/${caseId}/parecer`}
                >
                  <Pencil /> Editar parecer
                </Link>
                <Link
                  className="secondary-button"
                  href={`/dashboard/diagnosticos/${caseId}/relatorio`}
                >
                  <Eye /> Ver parecer aprovado
                </Link>
                <Link className="primary-button" href={`/dashboard/diagnosticos/${caseId}/email`}>
                  <Send /> Preparar entrega
                </Link>
              </>
            ) : sending ? (
              <Link className="primary-button" href={`/dashboard/diagnosticos/${caseId}/relatorio`}>
                <Eye /> Acompanhar diagnóstico
              </Link>
            ) : (
              <>
                <Link className="secondary-button" href={`/dashboard/diagnosticos/${caseId}/email`}>
                  <Mail /> Pedir informações
                </Link>
                <Link className="primary-button" href={`/dashboard/diagnosticos/${caseId}/parecer`}>
                  <Pencil /> {data.review ? "Editar parecer" : "Iniciar parecer"}
                </Link>
              </>
            )}
          </div>

          {actionError && (
            <p className="detail-action-error" role="alert">
              {actionError}
            </p>
          )}
        </div>
      </header>

      <div className="detail-layout">
        <main className="detail-content">
          <section className="assessment-hero">
            <div className="score-ring">
              <strong>{ai?.overallScore ?? "—"}</strong>
              <small>/ 100</small>
            </div>
            <div>
              <p className="eyebrow">
                <Brain /> Leitura automática · rascunho interno
              </p>
              <h2>{ai ? `Preparo ${ai.readinessLevel}` : "Análise ainda não concluída"}</h2>
              <p>
                {ai?.executiveSummary ??
                  "O caso está aguardando o processamento estruturado da análise preliminar."}
              </p>
            </div>
          </section>

          {ai && (
            <>
              <section className="analysis-grid">
                <AnalysisCard
                  title="Pontos fortes"
                  icon={<Sparkles />}
                  items={ai.strengths}
                  tone="success"
                />
                <AnalysisCard
                  title="Riscos principais"
                  icon={<ShieldAlert />}
                  items={ai.risks}
                  tone="warning"
                />
              </section>

              {ai.technicalAlerts.length > 0 && (
                <section className="technical-alerts">
                  <header>
                    <AlertTriangle />
                    <div>
                      <p className="eyebrow">Atenção técnica</p>
                      <h2>Validação profissional necessária</h2>
                    </div>
                  </header>
                  <ul>
                    {ai.technicalAlerts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>
                    Alertas não determinam elegibilidade e não devem ser convertidos automaticamente em conclusões.
                  </p>
                </section>
              )}

              <section className="priority-timeline">
                <p className="eyebrow">
                  <Clock3 /> Plano de preparação
                </p>
                <h2>Prioridades por horizonte</h2>
                <div>
                  <PriorityColumn label="3 meses" items={ai.priorities.threeMonths} />
                  <PriorityColumn label="6 meses" items={ai.priorities.sixMonths} />
                  <PriorityColumn label="12 meses" items={ai.priorities.twelveMonths} />
                </div>
              </section>

              <section className="analysis-grid">
                <AnalysisCard
                  title="Compatibilidade regional"
                  icon={<MapPin />}
                  items={ai.regionalCompatibility}
                />
                <AnalysisCard
                  title="Estimativa financeira"
                  icon={<CircleDollarSign />}
                  items={[ai.initialInvestmentRange, ai.recommendedReserve]}
                />
              </section>
            </>
          )}

          <section className="original-answers">
            <header>
              <div>
                <p className="eyebrow">
                  <UserRound /> Fonte original
                </p>
                <h2>Respostas do cliente</h2>
              </div>
              <span>Somente leitura</span>
            </header>

            {diagnosticSections.map((section) => (
              <details key={section.key}>
                <summary>
                  <span>{section.number}</span>
                  {section.title}
                  <small>
                    {section.questions.filter((question) => data.answers[question.key] !== undefined).length} respostas
                  </small>
                </summary>
                <dl>
                  {section.questions
                    .filter(
                      (question) =>
                        data.answers[question.key] !== undefined && data.answers[question.key] !== "",
                    )
                    .map((question) => (
                      <div key={question.key}>
                        <dt>{question.label}</dt>
                        <dd>
                          {Array.isArray(data.answers[question.key])
                            ? (data.answers[question.key] as string[]).join(", ")
                            : String(data.answers[question.key])}
                        </dd>
                      </div>
                    ))}
                </dl>
              </details>
            ))}
          </section>
        </main>

        <aside className="detail-sidebar">
          <section>
            <p className="eyebrow">Estado do caso</p>
            <span className={`status-pill status-${data.case.status}`}>
              {getCaseStatusLabel(data.case.status)}
            </span>
            <dl>
              <div>
                <dt>
                  <CalendarDays /> Enviado
                </dt>
                <dd>
                  {data.case.submitted_at ? new Date(data.case.submitted_at).toLocaleDateString("pt-BR") : "Ainda não"}
                </dd>
              </div>
              <div>
                <dt>
                  <Clock3 /> Atualizado
                </dt>
                <dd>{new Date(data.case.updated_at).toLocaleString("pt-BR")}</dd>
              </div>
              <div>
                <dt>
                  <FileText /> Parecer
                </dt>
                <dd>
                  {data.review
                    ? `v${data.review.version} · ${getReviewStatusLabel(data.review.status)}`
                    : "Não iniciado"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="quick-links">
            <p className="eyebrow">Ações</p>
            <Link href={`/dashboard/diagnosticos/${caseId}/relatorio`}>
              {delivered ? "Ver diagnóstico enviado" : "Pré-visualizar relatório"} <ArrowUpRight />
            </Link>
            {!delivered && !sending && (
              <Link href={`/dashboard/diagnosticos/${caseId}/email`}>
                Preparar e-mail <ArrowUpRight />
              </Link>
            )}
          </section>

          <section className="timeline">
            <p className="eyebrow">Linha do tempo</p>
            {data.history.map((event) => (
              <div key={event.id}>
                <span />
                <strong>{getCaseStatusLabel(event.to_status)}</strong>
                <small>{new Date(event.created_at).toLocaleString("pt-BR")}</small>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}

function AnalysisCard({
  title,
  icon,
  items,
  tone = "",
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone?: string;
}) {
  return (
    <article className={`analysis-card ${tone}`}>
      <header>
        {icon}
        <h2>{title}</h2>
      </header>
      <ul>
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>Nenhum item registrado.</li>}
      </ul>
    </article>
  );
}

function PriorityColumn({ label, items }: { label: string; items: string[] }) {
  return (
    <article>
      <b>{label}</b>
      <ol>
        {items.map((item, index) => (
          <li key={item}>
            <span>{index + 1}</span>
            {item}
          </li>
        ))}
      </ol>
    </article>
  );
}
