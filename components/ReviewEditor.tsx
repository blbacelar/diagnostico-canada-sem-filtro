"use client";
/* eslint-disable react-hooks/exhaustive-deps -- Autosave intentionally reacts only to draft changes. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Eye, Save, Sparkles } from "lucide-react";
import { detailFetch, type CaseDetailData } from "./DiagnosticDetail";

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
const emptyDraft: ReviewDraft = { coherentPath: "", assumptionsToReview: "", likelyMistakes: "", immediateFocus: "", studyStrategy: "", validationRisks: "", additionalNotes: "", nextSteps: ["", "", ""], recommendedResources: [] };

export function ReviewEditor({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<CaseDetailData | null>(null); const [draft, setDraft] = useState<ReviewDraft>(emptyDraft); const [state, setState] = useState("Carregando…"); const [error, setError] = useState(""); const initialized = useRef(false);
  useEffect(() => { detailFetch(`/api/dashboard/cases/${caseId}`).then((data) => { setDetail(data); return detailFetch(`/api/diagnostics/reviews?caseId=${caseId}`); }).then((review) => { if (review.review) setDraft({ ...emptyDraft, ...review.review, nextSteps: review.review.next_steps ?? ["","",""], recommendedResources: review.review.recommended_resources ?? [] }); initialized.current = true; setState("Tudo salvo"); }).catch(() => setError("Não foi possível abrir o parecer.")); }, [caseId]);
  useEffect(() => { if (!initialized.current) return; setState("Salvando…"); const timer = setTimeout(() => save("draft"), 1000); return () => clearTimeout(timer); }, [draft]);
  async function save(status: "draft" | "ready_for_approval") { try { await detailFetch("/api/diagnostics/reviews", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId, ...draft, status }) }); setState(status === "draft" ? "Tudo salvo" : "Pronto para aprovação"); } catch (saveError) { if (saveError instanceof Error) setError(saveError.message); setState("Falha ao salvar"); } }
  if (!detail) return <div className="dashboard-loading"><span /><span /></div>;
  return <div className="review-editor"><div className="detail-back"><Link href={`/dashboard/diagnosticos/${caseId}`}><ArrowLeft /> Voltar ao caso</Link><span><Save /> {state}</span></div><header><div><p className="eyebrow">Parecer profissional</p><h1>{detail.client.full_name}</h1><p>{detail.case.case_number} · edição estruturada e versionada</p></div><div><Link className="secondary-button" href={`/dashboard/diagnosticos/${caseId}/relatorio`}><Eye /> Pré-visualizar</Link><button className="primary-button" onClick={() => save("ready_for_approval")}><Check /> Pronto para aprovação</button></div></header><div className="review-editor-layout"><main><div className="human-note"><span>H</span><p><strong>Texto humano</strong>O conteúdo abaixo compõe a entrega. Sugestões automáticas nunca sobrescrevem sua escrita.</p></div>{fields.map(([key,label,placeholder]) => <label className="review-field" key={key}><span>{label}</span><textarea value={draft[key]} placeholder={placeholder} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<fieldset className="next-steps"><legend>Três próximos passos prioritários</legend>{draft.nextSteps.map((value,index) => <label key={index}><span>{index+1}</span><input value={value} onChange={(event) => setDraft((current) => ({ ...current, nextSteps: current.nextSteps.map((item,itemIndex) => itemIndex === index ? event.target.value : item) }))} placeholder={`Passo prioritário ${index+1}`} /></label>)}</fieldset>{error && <p className="form-error" role="alert">{error}</p>}</main><aside><p className="eyebrow"><Sparkles /> Rascunho automático</p><h2>Referências da análise</h2><section><strong>Resumo executivo</strong><p>{detail.assessment?.structured_result.executiveSummary ?? "Análise indisponível."}</p></section><section><strong>Perguntas sugeridas</strong><ul>{detail.assessment?.structured_result.followUpQuestions?.map((item) => <li key={item}>{item}</li>)}</ul></section><section><strong>Alertas técnicos</strong><ul>{detail.assessment?.structured_result.technicalAlerts?.map((item) => <li key={item}>{item}</li>)}</ul></section></aside></div></div>;
}
