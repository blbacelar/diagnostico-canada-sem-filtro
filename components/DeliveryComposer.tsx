"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Review payload is validated by the server schema. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Eye, Mail, Send } from "lucide-react";

import { getDeliveryStatusMessage } from "../lib/status-labels";
import { detailFetch, type CaseDetailData } from "./DiagnosticDetail";
import { DashboardError } from "./DashboardData";
import { Button } from "./ui/button";

const purchaseDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function DeliveryComposer({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<CaseDetailData | null>(null);
  const [review, setReview] = useState<any>(null);
  const [subject, setSubject] = useState(
    "Seu Diagnóstico Canadá Sem Filtro está pronto",
  );
  const [body, setBody] = useState(
    "Olá!\n\nConcluímos a revisão profissional do seu diagnóstico. No relatório, você encontrará uma leitura contextualizada do seu momento, os pontos que pedem atenção e três próximos passos prioritários.\n\nLeia com calma e lembre-se dos limites educacionais apresentados no documento.\n\nCom carinho,\nEquipe Canadá Sem Filtro\n\nImportante: O diagnóstico Canadá Sem Filtro não é uma consulta de imigração. É um conteúdo educativo para ajudar você a conhecer a realidade de viver no Canadá — incluindo desafios, custos, oportunidades e aspectos que nem sempre aparecem nas redes sociais.\n\nPara uma análise individual do seu perfil imigratório, é necessário agendar uma consulta profissional.",
  );
  const [deliveryMethod, setDeliveryMethod] = useState<"secure_link" | "pdf">(
    "secure_link",
  );
  const [state, setState] = useState("");
  const [error, setError] = useState("");

  const deliveryWindow = detail?.delivery_window;
  const deliveryUnlocked = deliveryWindow?.eligible_to_send ?? true;

  useEffect(() => {
    detailFetch<CaseDetailData>(`/api/dashboard/cases/${caseId}`)
      .then((data) => {
        setDetail(data);
        if (data.case.status === "sent") return null;
        return detailFetch(`/api/diagnostics/reviews?caseId=${caseId}`);
      })
      .then((data) => {
        if (data) setReview(data.review);
      })
      .catch((fetchError) => {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Não foi possível carregar a entrega.",
        );
      });
  }, [caseId]);

  async function approve() {
    if (!review) return;

    try {
      await detailFetch("/api/diagnostics/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, reviewId: review.id }),
      });
      const refreshed = await detailFetch<{ review: any }>(
        `/api/diagnostics/reviews?caseId=${caseId}`,
      );
      setReview(refreshed.review ?? { ...review, status: "approved" });
      setState("Parecer aprovado. A entrega pode ser enviada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao aprovar.");
    }
  }

  async function send() {
    if (!review) return;
    if (!deliveryUnlocked) {
      setError(
        deliveryWindow?.message ??
          "A entrega só é liberada após 7 dias da compra aprovada.",
      );
      return;
    }

    setState("Enviando…");
    setError("");

    try {
      const data = await detailFetch<{ delivery: { status: string } }>(
        "/api/diagnostics/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            caseId,
            reviewId: review.id,
            subject,
            body,
            deliveryMethod,
            idempotencyKey: crypto.randomUUID(),
          }),
        },
      );

      setState(getDeliveryStatusMessage(data.delivery.status));
      router.push("/dashboard/diagnosticos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
      setState("");
    }
  }

  if (error && !detail) {
    return <DashboardError title="Entrega indisponível" detail={error} />;
  }

  if (!detail) {
    return (
      <div className="dashboard-loading">
        <span />
        <span />
      </div>
    );
  }

  if (detail.case.status === "sent") {
    return (
      <div className="module-empty">
        <Check />
        <h2>Este diagnóstico já foi enviado</h2>
        <p>
          A entrega existente está preservada e não pode ser enviada novamente
          por esta tela.
        </p>
        <Link
          className="primary-button"
          href={`/dashboard/diagnosticos/${caseId}/relatorio`}
        >
          <Eye />
          Ver diagnóstico enviado
        </Link>
      </div>
    );
  }

  return (
    <div className="delivery-page">
      <div className="detail-back">
        <Link href={`/dashboard/diagnosticos/${caseId}`}>
          <ArrowLeft />
          Voltar ao caso
        </Link>
        <span>{detail.case.case_number}</span>
      </div>

      <header>
        <div>
          <p className="eyebrow">Comunicação final</p>
          <h1>Preparar entrega</h1>
          <p>Revise a mensagem exatamente como o cliente a receberá.</p>
        </div>

        {review?.status !== "approved" ? (
          <Button variant="default" onClick={approve} disabled={review?.status !== "ready_for_approval"}>
            <Check />
            Aprovar parecer
          </Button>
        ) : (
          <span className="approval-badge">
            <Check />
            Parecer aprovado
          </span>
        )}
      </header>

      <div className="delivery-layout">
        <main>
          <label>
            <span>Destinatário</span>
            <input value={detail.client.email_display} readOnly />
          </label>

          {deliveryWindow?.purchase_date ? (
            <label>
              <span>Compra registrada</span>
              <input
                value={purchaseDateFormatter.format(
                  new Date(deliveryWindow.purchase_date),
                )}
                readOnly
              />
            </label>
          ) : null}

          <label>
            <span>Assunto</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>

          <label>
            <span>Corpo do e-mail</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>

          <fieldset>
            <legend>Forma de entrega</legend>

            <label
              className={deliveryMethod === "secure_link" ? "selected" : ""}
            >
              <input
                type="radio"
                checked={deliveryMethod === "secure_link"}
                onChange={() => setDeliveryMethod("secure_link")}
              />
              <Mail />
              <span>
                <strong>Link seguro</strong>
                Válido por 30 dias
              </span>
            </label>

            <label className={deliveryMethod === "pdf" ? "selected" : ""}>
              <input
                type="radio"
                checked={deliveryMethod === "pdf"}
                onChange={() => setDeliveryMethod("pdf")}
              />
              <span className="pdf-icon">PDF</span>
              <span>
                <strong>PDF + link seguro</strong>
                Documento anexado
              </span>
            </label>
          </fieldset>

          {state && (
            <p className="form-success" role="status">
              {state}
            </p>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {!deliveryUnlocked && (
            <p className="form-error" role="alert">
              {deliveryWindow?.message ??
                "A entrega só é liberada após 7 dias da compra aprovada."}
            </p>
          )}

          <Button
            variant="default"
            disabled={
              review?.status !== "approved" ||
              state === "Enviando…" ||
              !deliveryUnlocked
            }
            onClick={send}
          >
            <Send />
            Confirmar e enviar
          </Button>
        </main>

        <aside>
          <p className="eyebrow">Pré-visualização</p>
          <div className="email-preview">
            <header>
              <strong>
                Canadá <em>sem filtro</em>
              </strong>
              <small>Diagnóstico profissional</small>
            </header>
            <section>
              <h2>Seu diagnóstico está pronto</h2>
              <p>{body}</p>
              <span>Abrir diagnóstico final</span>
            </section>
            <footer>Conteúdo educacional e de planejamento.</footer>
          </div>
        </aside>
      </div>
    </div>
  );
}
