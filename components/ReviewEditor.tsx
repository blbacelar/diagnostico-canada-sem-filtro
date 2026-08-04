"use client";
/* eslint-disable react-hooks/exhaustive-deps -- Autosave intentionally reacts only to draft changes. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Eye, FileText, Save, Sparkles } from "lucide-react";
import { detailFetch, type CaseDetailData } from "./DiagnosticDetail";
import { DashboardError } from "./DashboardData";
import { isReviewImmutable } from "../lib/case-lifecycle";

const fields = [
  ["coherentPath", "Caminho mais coerente", "Descreva o caminho que melhor combina com perfil e prazo."],
  ["assumptionsToReview", "Premissas a revisar", "Quais hipóteses precisam ser questionadas ou validadas?"],
  ["likelyMistakes", "Erros que podem estar próximos", "Aponte decisões precipitadas, custos ou atalhos arriscados."],
  ["immediateFocus", "Foco imediato recomendado", "Idioma, finanças, experiência, formação, documentação…"],
  ["studyStrategy", "Estudar no Canadá como estratégia", "Contextualize quando faz sentido e quais são os limites."],
  ["validationRisks", "Riscos que exigem validação", "Registre os temas que precisam de análise profissional específica."],
  ["additionalNotes", "Observações adicionais", "Inclua apenas o que deve fazer parte da entrega final."],
] as const;

type ReviewDraft = Record<(typeof fields)[number][0], string> & { nextSteps: string[]; recommendedResources: string[] };
type ReviewResponse = { review: Record<string, unknown> | null };

const emptyDraft: ReviewDraft = {
  coherentPath: "",
  assumptionsToReview: "",
  likelyMistakes: "",
  immediateFocus: "",
  studyStrategy: "",
  validationRisks: "",
  additionalNotes: "",
  nextSteps: ["", "", ""],
  recommendedResources: [],
};

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown, length?: number) {
  const list = Array.isArray(value) ? value.map((item) => textValue(item)) : [];
  if (length === undefined) return list;
  return [...list, ...Array.from({ length }, () => "")].slice(0, length);
}

function toDraft(review: Record<string, unknown>): ReviewDraft {
  return {
    coherentPath: textValue(review.coherent_path ?? review.coherentPath),
    assumptionsToReview: textValue(review.assumptions_to_review ?? review.assumptionsToReview),
    likelyMistakes: textValue(review.likely_mistakes ?? review.likelyMistakes),
    immediateFocus: textValue(review.immediate_focus ?? review.immediateFocus),
    studyStrategy: textValue(review.study_strategy ?? review.studyStrategy),
    validationRisks: textValue(review.validation_risks ?? review.validationRisks),
    additionalNotes: textValue(review.additional_notes ?? review.additionalNotes),
    nextSteps: stringList(review.next_steps ?? review.nextSteps, 3),
    recommendedResources: stringList(review.recommended_resources ?? review.recommendedResources),
  };
}

export function ReviewEditor({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<CaseDetailData | null>(null);
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);
  const [state, setState] = useState("Carregando…");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    detailFetch<CaseDetailData>(`/api/dashboard/cases/${caseId}`)
      .then((data) => {
        setDetail(data);
        if (isReviewImmutable(data.case.status)) {
          setState("Somente leitura");
          return null;
        }
        return detailFetch<ReviewResponse>(`/api/diagnostics/reviews?caseId=${caseId}`);
      })
      .then((response) => {
        if (!response) return;
        if (response.review) setDraft(toDraft(response.review));
        initialized.current = true;
        setState("Tudo salvo");
      })
      .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : "Não foi possível abrir o parecer."));

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [caseId]);

  useEffect(() => {
    if (!initialized.current) return;
    setNotice("");
    setState("Salvando…");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void save("draft");
    }, 700);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [draft]);

  async function save(status: "draft" | "ready_for_approval") {
    if (status === "ready_for_approval") {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      setSaving(true);
    }
    setError("");
    const operation = saveChain.current.then(async () => {
      await detailFetch("/api/diagnostics/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, ...draft, status }),
      });
      setState(status === "draft" ? "Tudo salvo" : "Pronto para aprovação");
      if (status === "ready_for_approval") setNotice("Parecer salvo e enviado para aprovação.");
    });
    saveChain.current = operation.catch(() => undefined);
    try {
      await operation;
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o parecer.");
      setState("Falha ao salvar");
      return false;
    } finally {
      if (status === "ready_for_approval") setSaving(false);
    }
  }

  async function saveBeforeLeaving(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!initialized.current) return;
    event.preventDefault();
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (await save("draft")) window.location.assign(`/dashboard/diagnosticos/${caseId}`);
  }

  if (error && !detail) return <DashboardError title="Parecer indisponível" detail={error} />;
  if (!detail) return <div className="dashboard-loading"><span /><span /></div>;
  if (isReviewImmutable(detail.case.status)) return <div className="module-empty"><FileText /><h2>Este parecer está concluído</h2><p>O conteúdo aprovado é um registro protegido e não pode mais ser alterado. Abra o relatório para consultar a versão existente ou volte ao caso para iniciar um novo diagnóstico.</p><Link className="primary-button" href={`/dashboard/diagnosticos/${caseId}/relatorio`}><Eye /> Ver relatório</Link></div>;

  return <div className="review-editor"><div className="review-editor-header"><div className="detail-back"><Link href={`/dashboard/diagnosticos/${caseId}`} onClick={saveBeforeLeaving}><ArrowLeft /> Voltar ao caso</Link><span><Save /> {state}</span></div><header><div><p className="eyebrow">Parecer profissional</p><h1>{detail.client.full_name}</h1><p>{detail.case.case_number} · edição estruturada e versionada</p></div><div className="review-actions"><div className="review-action-buttons"><Link className="secondary-button" href={`/dashboard/diagnosticos/${caseId}/relatorio`}><Eye /> Pré-visualizar</Link><button className="primary-button" type="button" onClick={() => void save("ready_for_approval")} disabled={saving}><Check /> {saving ? "Salvando…" : "Pronto para aprovação"}</button></div>{error && <p className="review-save-error" role="alert">{error}</p>}{notice && <p className="review-save-success" role="status">{notice}</p>}</div></header></div><div className="review-editor-layout"><main><div className="human-note"><span>H</span><p><strong>Texto humano</strong>O conteúdo abaixo compõe a entrega. Sugestões automáticas nunca sobrescrevem sua escrita.</p></div>{fields.map(([key,label,placeholder]) => <label className="review-field" key={key}><span>{label}</span><textarea value={draft[key]} placeholder={placeholder} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<fieldset className="next-steps"><legend>Três próximos passos prioritários</legend>{draft.nextSteps.map((value,index) => <label key={index}><span>{index+1}</span><input value={value} onChange={(event) => setDraft((current) => ({ ...current, nextSteps: current.nextSteps.map((item,itemIndex) => itemIndex === index ? event.target.value : item) }))} placeholder={`Passo prioritário ${index+1}`} /></label>)}</fieldset></main><aside><p className="eyebrow"><Sparkles /> Rascunho automático</p><h2>Referências da análise</h2><section><strong>Resumo executivo</strong><p>{detail.assessment?.structured_result.executiveSummary ?? "Análise indisponível."}</p></section><section><strong>Perguntas sugeridas</strong><ul>{detail.assessment?.structured_result.followUpQuestions?.map((item) => <li key={item}>{item}</li>)}</ul></section><section><strong>Alertas técnicos</strong><ul>{detail.assessment?.structured_result.technicalAlerts?.map((item) => <li key={item}>{item}</li>)}</ul></section></aside></div></div>;
}
