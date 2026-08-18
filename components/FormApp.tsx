"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Cloud, CloudOff, LockKeyhole, Pencil, Send } from "lucide-react";
import { formatCurrencyAmount, formatCurrencyEditingAmount, normalizeCurrencyInput } from "../lib/currency";
import { legalDisclaimerParagraphs, legalDisclaimerTitle } from "../lib/legal-disclaimer";
import { operationalConfig } from "../lib/operational-config";
import { diagnosticSections, layoutQuestionRows, pruneHiddenAnswers, visibleQuestions } from "../lib/questions";
import { validateQuestionAnswer, validationErrorsForDiagnostic, validationErrorsForSection } from "../lib/diagnostic-validation";
import type { DiagnosticQuestion, FormAnswers } from "../lib/types";
import { cn } from "../lib/utils";
import { BrandMark } from "./BrandMark";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";

type SessionData = { caseId: string; caseNumber: string; status: string; answers: FormAnswers; client: { fullName: string }; submittedAt: string | null; policyVersion?: string; consultantManaged?: boolean };
type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

export function FormApp({ initialToken, dashboardReturn = false }: { initialToken?: string; dashboardReturn?: boolean }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<{ caseNumber: string; expectedTime: string } | null>(null);
  const answersRef = useRef<FormAnswers>({});
  const initialized = useRef(false);
  const submitInFlight = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReview = step === diagnosticSections.length;
  const dashboardMode = dashboardReturn || session?.consultantManaged === true;

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/diagnostics/form-session", {
          headers: initialToken ? { Authorization: `Bearer ${initialToken}` } : {},
          credentials: "same-origin",
        });
        const data = await response.json() as SessionData & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Este link não é mais válido.");
        setSession(data);
        answersRef.current = data.answers ?? {};
        setAnswers(answersRef.current);
        if (initialToken && window.location.search) window.history.replaceState({}, "", "/formulario");
        initialized.current = true;
      } catch (error) {
        setFatalError(error instanceof Error ? error.message : "Este link não é mais válido.");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [initialToken]);

  useEffect(() => {
    if (!initialized.current || !session || session.status !== "client_draft") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      if (!navigator.onLine) { setSaveState("offline"); return; }
      try {
        const response = await fetch("/api/diagnostics/answers", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, schemaVersion: 1 }),
        });
        if (!response.ok) {
          const data = await response.json() as { code?: string };
          if (data.code === "ANSWERS_LOCKED") {
            setSession((current) => current ? { ...current, status: "submitted" } : current);
            setSaveState("saved");
            return;
          }
          throw new Error();
        }
        setSaveState("saved");
      } catch { setSaveState("error"); }
    }, 850);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [answers, session]);

  const sectionValidationErrors = useMemo(
    () => diagnosticSections.map((section) => validationErrorsForSection(section, answers)),
    [answers],
  );
  const incompleteSections = sectionValidationErrors.map((errors) => Object.keys(errors).length);
  const completedSections = incompleteSections.filter((count) => count === 0).length;
  const progress = isReview ? 100 : Math.round((completedSections / diagnosticSections.length) * 100);

  function update(question: DiagnosticQuestion, value: unknown) {
    const nextAnswers = pruneHiddenAnswers({ ...answersRef.current, [question.key]: value });
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    setFieldErrors((current) => {
      if (!(question.key in current)) return current;
      const message = validateQuestionAnswer(question, value, true);
      const next = { ...current };
      if (message) next[question.key] = message;
      else delete next[question.key];
      for (const section of diagnosticSections) {
        for (const conditionalQuestion of section.questions) {
          if (conditionalQuestion.showWhen && !(conditionalQuestion.key in nextAnswers)) delete next[conditionalQuestion.key];
        }
      }
      return next;
    });
  }

  function validateField(question: DiagnosticQuestion) {
    const message = validateQuestionAnswer(question, answers[question.key], true);
    setFieldErrors((current) => {
      const next = { ...current };
      if (message) next[question.key] = message;
      else delete next[question.key];
      return next;
    });
  }

  function next() {
    if (!isReview && incompleteSections[step] > 0) {
      setFieldErrors((current) => ({ ...current, ...sectionValidationErrors[step] }));
      setSubmitError(`Confira ${incompleteSections[step]} ${incompleteSections[step] === 1 ? "campo inválido ou obrigatório" : "campos inválidos ou obrigatórios"} antes de avançar.`);
      window.requestAnimationFrame(() => document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setSubmitError("");
    setStep((current) => Math.min(diagnosticSections.length, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (submitInFlight.current || session?.status !== "client_draft") return;
    if (!disclaimerAccepted) {
      setSubmitError("Você precisa confirmar que leu o aviso legal para enviar o simulador.");
      return;
    }
    const validationErrors = validationErrorsForDiagnostic(answers);
    const totalInvalid = Object.keys(validationErrors).length;
    if (totalInvalid) {
      const firstInvalidSection = diagnosticSections.findIndex((item) => item.questions.some((question) => validationErrors[question.key]));
      setFieldErrors(validationErrors);
      setSubmitError(`Ainda existem ${totalInvalid} ${totalInvalid === 1 ? "resposta inválida ou pendente" : "respostas inválidas ou pendentes"}.`);
      if (firstInvalidSection >= 0) setStep(firstInvalidSection);
      window.requestAnimationFrame(() => document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    submitInFlight.current = true;
    setIsSubmitting(true);
    setSubmitError("");
    setSaveState("saving");
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const saveResponse = await fetch("/api/diagnostics/answers", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, schemaVersion: 1 }) });
      if (!saveResponse.ok) {
        const saveData = await saveResponse.json() as { code?: string };
        if (saveData.code === "ANSWERS_LOCKED") {
          setSession((current) => current ? { ...current, status: "submitted" } : current);
          setSaveState("saved");
          return;
        }
        throw new Error("Não foi possível salvar a versão final.");
      }
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/diagnostics/submit", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ consent: true, legalDisclaimerAccepted: true, policyVersion: session.policyVersion ?? operationalConfig.policyVersion, idempotencyKey }),
      });
      const data = await response.json() as { error?: string; code?: string; caseNumber: string; expectedTime: string };
      if (!response.ok) {
        if (data.code === "ALREADY_SUBMITTED") {
          setSession((current) => current ? { ...current, status: "submitted" } : current);
          setSaveState("saved");
          return;
        }
        throw new Error(data.error ?? "Não foi possível enviar.");
      }
      setSubmitted({ caseNumber: data.caseNumber, expectedTime: data.expectedTime });
      setSaveState("saved");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível enviar.");
      setSaveState("error");
    } finally {
      submitInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (submitted && dashboardMode && session?.caseId) {
      const timer = setTimeout(() => {
        window.location.assign(`/dashboard/diagnosticos/${session.caseId}`);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [submitted, dashboardMode, session]);

  if (loading) return <FormStatus title="Abrindo seu simulador" detail="Validando o link pessoal com segurança…" />;
  if (fatalError) return <FormStatus error title="Este link não pode ser usado" detail={fatalError} dashboardHref={dashboardReturn ? "/dashboard/diagnosticos" : undefined} />;
  if (submitted) {
    if (dashboardMode) {
      return <FormStatus success title="Simulador atualizado" detail={`As respostas de ${submitted.caseNumber} foram salvas com sucesso. Redirecionando para a ficha do caso…`} dashboardHref={`/dashboard/diagnosticos/${session?.caseId ?? ""}`} />;
    }
    return <FormStatus success title="Respostas recebidas" detail={`O simulador ${submitted.caseNumber} foi enviado. Prazo estimado: ${submitted.expectedTime}. A análise automática ficará restrita às consultoras até a revisão profissional.`} />;
  }
  if (!session) return null;
  if (session.status !== "client_draft" && !dashboardMode) return <FormStatus success title="Simulador já enviado" detail={`As respostas de ${session.caseNumber} estão protegidas e não podem mais ser alteradas. Se a equipe precisar de informações adicionais, você receberá uma nova comunicação.`} dashboardHref={dashboardMode ? `/dashboard/diagnosticos/${session.caseId}` : undefined} />;

  const section = diagnosticSections[step];
  const sectionQuestions = isReview ? [] : visibleQuestions(section, answers);
  const sectionRows = isReview ? [] : layoutQuestionRows(section, answers);
  return (
    <div className="form-workspace">
      <header className="form-topbar">
        <BrandMark compact href={dashboardMode ? "/dashboard/diagnosticos" : "/"} />
        <div className={`save-state save-state--${saveState}`} role="status">
          {saveState === "offline" ? <CloudOff /> : <Cloud />}
          <span>{saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Tudo salvo" : saveState === "offline" ? "Sem conexão" : saveState === "error" ? "Falha ao salvar" : "Salvamento automático"}</span>
        </div>
        <div className="case-tag"><small>{dashboardMode ? "Modo Consultoria" : "Simulador"}</small><strong>{session.caseNumber}</strong></div>
      </header>
      <div className="progress-strip">
        <div><span style={{ width: `${progress}%` }} /></div>
        <p><strong>{progress}%</strong> concluído</p>
      </div>
      <div className="form-layout">
        <aside className="section-nav" aria-label="Seções do simulador">
          <p>Seu simulador</p>
          <ol>
            {diagnosticSections.map((item, index) => (
              <li key={item.key} className={index === step ? "active" : incompleteSections[index] === 0 ? "complete" : ""}>
                <button type="button" onClick={() => setStep(index)} aria-current={index === step ? "step" : undefined}>
                  <span>{incompleteSections[index] === 0 ? <Check /> : item.number}</span>{item.title}
                </button>
              </li>
            ))}
            <li className={isReview ? "active" : ""}><button type="button" onClick={() => setStep(diagnosticSections.length)}><span>12</span>Revisão e envio</button></li>
          </ol>
          <div className="privacy-note"><LockKeyhole /><p><strong>Seus dados são confidenciais.</strong> O simulador é acessado apenas pela equipe autorizada.</p></div>
        </aside>
        <main className="form-main">
          {isReview ? (
            <ReviewAnswers answers={answers} incompleteSections={incompleteSections} onEdit={setStep} onSubmit={submit} submitting={isSubmitting} error={submitError} consultantManaged={dashboardMode} disclaimerAccepted={disclaimerAccepted} onToggleDisclaimerAccepted={(accepted) => { setDisclaimerAccepted(accepted); if (accepted) setSubmitError(""); }} />
          ) : (
            <section className="question-section" aria-labelledby="section-title">
              <p className="eyebrow">Seção {section.number} de 11</p>
              <h1 id="section-title">{section.title}</h1>
              <p className="section-intro">{section.intro}</p>
              {section.sensitive && <div className="sensitive-notice"><LockKeyhole /><p><strong>Informação sensível</strong>Este conteúdo não aparece em URLs, listas resumidas ou registros técnicos.</p></div>}
              <div className="questions-stack">
                {sectionRows.map((row) => (
                  <div className="question-row" data-layout-row={row.key} key={row.key}>
                    {row.questions.map((question) => (
                      <QuestionField key={question.key} question={question} value={answers[question.key]} currencyCode={question.format === "currency" ? String(answers.funds_currency ?? "") : undefined} onChange={(value) => update(question, value)} onBlur={() => validateField(question)} error={fieldErrors[question.key]} index={sectionQuestions.findIndex((item) => item.key === question.key) + 1} />
                    ))}
                  </div>
                ))}
                {section.key === "spouse" && sectionQuestions.length === 0 && <div className="not-applicable"><Check /><h2>Esta seção não se aplica</h2><p>Com base no estado civil informado, você pode seguir para a próxima etapa.</p></div>}
              </div>
              {submitError && <p className="inline-alert" role="alert"><AlertTriangle />{submitError}</p>}
              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}><ArrowLeft /> Voltar</button>
                <button className="primary-button" type="button" onClick={next}>Continuar <ArrowRight /></button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function QuestionField({ question, value, currencyCode, onChange, onBlur, error, index }: { question: DiagnosticQuestion; value: unknown; currencyCode?: string; onChange: (value: unknown) => void; onBlur: () => void; error?: string; index: number }) {
  const id = `field-${question.key}`;
  const labelId = `${id}-label`;
  const invalid = Boolean(error);
  const describedBy = error ? `${id}-error` : undefined;
  const common = { id, name: question.key, "aria-invalid": invalid, "aria-labelledby": labelId, "aria-describedby": describedBy, required: question.required };
  const current = value === undefined || value === null ? "" : String(value);
  const layout = question.layout ?? "full";
  return (
    <fieldset className={cn("question-card", `question-card--${layout}`, question.type === "boolean" && "question-card--boolean", invalid && "question-card--invalid")} data-question-key={question.key} aria-describedby={describedBy}>
      <legend><small>{String(index).padStart(2, "0")}</small><span id={labelId}>{question.label}{question.required ? <b>{"\u00a0*"}</b> : <em>{question.optionalLabel ?? "Opcional"}</em>}</span></legend>
      {question.type === "textarea" && <Textarea {...common} className="question-control question-control--textarea" value={current} maxLength={5000} placeholder={question.placeholder} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />}
      {question.format === "currency" && <CurrencyInput {...common} value={value} currencyCode={currencyCode} placeholder={question.placeholder} onChange={onChange} onBlur={onBlur} />}
      {question.format !== "currency" && (question.type === "text" || question.type === "email") && <Input {...common} className="question-control" type={question.type} value={current} maxLength={300} placeholder={question.placeholder} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />}
      {question.format !== "currency" && question.type === "number" && <Input {...common} className="question-control" type="number" inputMode="numeric" step={1} value={current} min={question.min} max={question.max} placeholder={question.placeholder} onKeyDown={(event) => { if (["e", "E", "+", "-", ".", ","].includes(event.key)) event.preventDefault(); }} onBlur={onBlur} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} />}
      {question.type === "select" && (
        <Select name={question.key} value={current} required={question.required} onValueChange={(nextValue) => { onChange(nextValue); }}>
          <SelectTrigger {...common} className="question-control" aria-describedby={describedBy}>
            <SelectValue placeholder="Selecione uma opção" />
          </SelectTrigger>
          <SelectContent position="popper" align="start" className="question-select-content">
            {question.options?.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {question.type === "boolean" && (
        <div className={cn("boolean-option", (value === true || value === "Sim") && "selected")}>
          <Checkbox id={id} name={question.key} checked={value === true || value === "Sim"} aria-invalid={invalid} aria-describedby={describedBy} aria-labelledby={`${id}-choice`} onBlur={onBlur} onCheckedChange={(checked) => onChange(checked === true)} />
          <Label id={`${id}-choice`} htmlFor={id}>Tenho filhos</Label>
          <p>Marque esta opção para informar quantidade e idades.</p>
        </div>
      )}
      {question.type === "radio" && (
        <RadioGroup className="option-grid" name={question.key} value={current} required={question.required} aria-invalid={invalid} aria-describedby={describedBy} aria-labelledby={labelId} onBlur={onBlur} onValueChange={onChange}>
          {question.options?.map((option, optionIndex) => {
            const optionId = `${id}-${optionIndex}`;
            return <Label key={option} htmlFor={optionId} className={current === option ? "selected" : ""}><span>{option}</span><RadioGroupItem id={optionId} value={option} /></Label>;
          })}
        </RadioGroup>
      )}
      {(question.type === "multi" || question.type === "checkbox") && (
        <div className="option-grid option-grid--multi" role="group" aria-describedby={describedBy} aria-labelledby={labelId} onBlur={onBlur}>
          {question.options?.map((option, optionIndex) => {
            const values = Array.isArray(value) ? value as string[] : [];
            const checked = values.includes(option);
            const optionId = `${id}-${optionIndex}`;
            return <div key={option} className={cn("multi-option", checked && "selected")}><Checkbox id={optionId} checked={checked} aria-invalid={invalid} aria-describedby={describedBy} onCheckedChange={(nextChecked) => onChange(nextChecked === true ? [...values, option] : values.filter((item) => item !== option))} /><Label htmlFor={optionId}>{option}</Label></div>;
          })}
        </div>
      )}
      {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
    </fieldset>
  );
}

function CurrencyInput({ id, name, value, currencyCode, placeholder, required, "aria-invalid": ariaInvalid, "aria-labelledby": ariaLabelledBy, "aria-describedby": ariaDescribedBy, onChange, onBlur }: { id: string; name: string; value: unknown; currencyCode?: string; placeholder?: string; required?: boolean; "aria-invalid": boolean; "aria-labelledby": string; "aria-describedby"?: string; onChange: (value: unknown) => void; onBlur: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const code = String(currencyCode ?? "").toUpperCase();

  return (
    <div className="currency-input">
      <Input
        id={id}
        name={name}
        className="question-control question-control--currency"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={editing ? draft : formatCurrencyAmount(value, code)}
        placeholder={placeholder}
        required={required}
        aria-invalid={ariaInvalid}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onFocus={() => { setDraft(formatCurrencyEditingAmount(value)); setEditing(true); }}
        onChange={(event) => {
          const normalized = normalizeCurrencyInput(event.target.value);
          setDraft(normalized.display);
          onChange(normalized.value);
        }}
        onBlur={() => { setEditing(false); onBlur(); }}
      />
      {code && <span className="currency-input__code" aria-hidden="true">{code}</span>}
    </div>
  );
}

function ReviewAnswers({ answers, incompleteSections, onEdit, onSubmit, submitting, error, consultantManaged, disclaimerAccepted, onToggleDisclaimerAccepted }: { answers: FormAnswers; incompleteSections: number[]; onEdit: (index: number) => void; onSubmit: () => void; submitting: boolean; error: string; consultantManaged: boolean; disclaimerAccepted: boolean; onToggleDisclaimerAccepted: (accepted: boolean) => void }) {
  return (
    <section className="question-section review-section">
      <p className="eyebrow">{consultantManaged ? "Revisão pela consultoria" : "Revisão final"}</p>
      <h1>{consultantManaged ? "Revise as alterações" : "Revise antes de enviar"}</h1>
      <p className="section-intro">{consultantManaged ? "Confira as respostas atualizadas antes de salvar a nova versão do simulador." : "Depois do envio, suas respostas formarão um registro protegido e só poderão ser reabertas pela equipe."}</p>
      <div className="review-list">
        {diagnosticSections.map((section, index) => <article key={section.key}><header><div><small>Seção {section.number}</small><h2>{section.title}</h2></div><button type="button" onClick={() => onEdit(index)}><Pencil /> Editar</button></header>{incompleteSections[index] > 0 && <p className="review-warning"><AlertTriangle /> {incompleteSections[index]} pendência(s)</p>}<dl>{visibleQuestions(section, answers).filter((question) => answers[question.key] !== undefined && answers[question.key] !== "").map((question) => { const answer = answers[question.key]; const formatted = question.format === "currency" ? formatCurrencyAmount(answer, String(answers.funds_currency ?? "")) : Array.isArray(answer) ? answer.join(", ") : typeof answer === "boolean" ? (answer ? "Sim" : "Não") : String(answer); return <div key={question.key}><dt>{question.label}</dt><dd>{formatted}</dd></div>; })}</dl></article>)}
      </div>
      <section className="review-disclaimer" aria-label={legalDisclaimerTitle}>
        <h2>{legalDisclaimerTitle}</h2>
        {legalDisclaimerParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>
      <label className="final-consent"><input type="checkbox" checked={disclaimerAccepted} onChange={(event) => onToggleDisclaimerAccepted(event.target.checked)} /><span><Check />{consultantManaged ? "Confirmo a atualização das respostas do cliente para o simulador." : "Confirmo que li e entendi o aviso legal acima e autorizo o uso das respostas para elaboração do simulador profissional."}</span></label>
      {error && <p className="inline-alert" role="alert"><AlertTriangle />{error}</p>}
      <div className="form-actions"><button className="secondary-button" type="button" onClick={() => onEdit(diagnosticSections.length - 1)}><ArrowLeft /> Voltar</button><button className="primary-button" type="button" disabled={submitting || !disclaimerAccepted} onClick={onSubmit}>{submitting ? "Salvando…" : (consultantManaged ? "Salvar e analisar" : "Enviar para análise")}<Send /></button></div>
    </section>
  );
}

function FormStatus({ title, detail, error = false, success = false, dashboardHref }: { title: string; detail: string; error?: boolean; success?: boolean; dashboardHref?: string }) {
  return <main className="status-page"><BrandMark /><section><span className={`status-orbit ${error ? "error" : success ? "success" : ""}`}>{error ? <AlertTriangle /> : success ? <Check /> : <Cloud />}</span><p className="eyebrow">Simulador Canadá Sem Filtro</p><h1>{title}</h1><p>{detail}</p>{dashboardHref ? <Link className="primary-button" href={dashboardHref}>Voltar ao dashboard</Link> : error && <Link className="primary-button" href="/">Solicitar um novo link</Link>}</section></main>;
}
