"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Clock3, LockKeyhole, Mail, Save } from "lucide-react";
import { resumeLinkSchema, sanitizedUtm, startDiagnosticSchema } from "../lib/schemas";
import { Button } from "./ui/button";

type Mode = "start" | "resume";
type FormStatus = "idle" | "sending" | "sent" | "error";
type FieldName = "fullName" | "email" | "emailConfirmation" | "consent";
type FieldErrors = Partial<Record<FieldName, string>>;

const fieldNames = new Set<FieldName>(["fullName", "email", "emailConfirmation", "consent"]);
const genericSubmissionError = "Não foi possível enviar o link agora. Tente novamente.";

class PublicSubmissionError extends Error {}

function errorsByField(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  return issues.reduce<FieldErrors>((errors, issue) => {
    const field = String(issue.path[0] ?? "") as FieldName;
    if (fieldNames.has(field) && !errors[field]) {
      errors[field] = issue.message;
    }
    return errors;
  }, {});
}

function FieldError({ field, errors }: { field: FieldName; errors: FieldErrors }) {
  return errors[field] ? (
    <p id={`${field}-error`} className="field-error" role="alert">
      {errors[field]}
    </p>
  ) : null;
}

export function LandingClient({ policyVersion }: { policyVersion: string }) {
  const [mode, setMode] = useState<Mode>("start");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const submissionInFlight = useRef(false);

  function focusFirstInvalid(form: HTMLFormElement, errors: FieldErrors) {
    const firstInvalid = (["fullName", "email", "emailConfirmation", "consent"] as const).find(
      (field) => errors[field],
    );
    if (!firstInvalid) return;
    requestAnimationFrame(() => {
      const control = form.elements.namedItem(firstInvalid);
      if (control instanceof HTMLElement) control.focus();
    });
  }

  function clearFieldError(field: string) {
    if (!fieldNames.has(field as FieldName)) return;
    setFieldErrors((current) => {
      if (!current[field as FieldName]) return current;
      const next = { ...current };
      delete next[field as FieldName];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rawPayload =
      mode === "start"
        ? {
            fullName: form.get("fullName"),
            email: form.get("email"),
            emailConfirmation: form.get("emailConfirmation"),
            consent: form.get("consent") === "on",
            policyVersion,
            source: "hotmart",
            website: form.get("website"),
            utm: sanitizedUtm(new URLSearchParams(window.location.search)),
          }
        : { email: form.get("email"), website: form.get("website") };
    const validation =
      mode === "start"
        ? startDiagnosticSchema.safeParse(rawPayload)
        : resumeLinkSchema.safeParse(rawPayload);

    if (!validation.success) {
      const errors = errorsByField(validation.error.issues);
      setFieldErrors(errors);
      setMessage(Object.keys(errors).length ? "" : "Confira os campos informados.");
      setStatus(Object.keys(errors).length ? "idle" : "error");
      focusFirstInvalid(formElement, errors);
      return;
    }

    submissionInFlight.current = true;
    setFieldErrors({});
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch(
        mode === "start" ? "/api/diagnostics/start" : "/api/diagnostics/resume-link",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validation.data),
        },
      );
      const data = (await response.json()) as { error?: string; message: string };
      if (!response.ok) throw new PublicSubmissionError(data.error ?? genericSubmissionError);
      setMessage(data.message);
      setStatus("sent");
    } catch (error) {
      setMessage(error instanceof PublicSubmissionError ? error.message : genericSubmissionError);
      setStatus("error");
    } finally {
      submissionInFlight.current = false;
    }
  }

  function switchMode() {
    setMode((current) => (current === "start" ? "resume" : "start"));
    setFieldErrors({});
    setMessage("");
    setStatus("idle");
  }

  return (
    <div className="landing-grid">
      <section className="landing-copy" aria-labelledby="landing-title">
        <p className="eyebrow">
          <span /> Canadá sem filtro · simulador
        </p>
        <h1 id="landing-title">
          Vamos entender o seu <em>projeto Canadá.</em>
        </h1>
        <p className="lede">
          Um olhar honesto sobre o seu momento, suas escolhas e o que precisa acontecer antes do próximo passo.
        </p>
        <div className="landing-facts" aria-label="Informações sobre o simulador">
          <div>
            <Clock3 aria-hidden="true" />
            <span>
              <small>Tempo estimado</small>
              <strong>25–35 minutos</strong>
            </span>
          </div>
          <div>
            <Save aria-hidden="true" />
            <span>
              <small>Seu ritmo</small>
              <strong>Salve e continue depois</strong>
            </span>
          </div>
          <div>
            <LockKeyhole aria-hidden="true" />
            <span>
              <small>Privacidade</small>
              <strong>Link pessoal e seguro</strong>
            </span>
          </div>
        </div>
        <blockquote>
          “O objetivo não é encaixar sua vida em uma promessa pronta. É construir uma leitura responsável do caminho.”
        </blockquote>
      </section>

      <section className="start-panel" aria-labelledby="form-title">
        <div className="start-panel__counter">CSF / 01</div>
        {status === "sent" ? (
          <div className="sent-state" role="status">
            <span className="sent-state__icon">
              <Mail aria-hidden="true" />
            </span>
            <p className="eyebrow">Link solicitado</p>
            <h2>Agora, confira seu e-mail.</h2>
            <p>{message}</p>
            <p className="fine-print">
              Verifique também a pasta de spam. Por segurança, a mensagem é sempre neutra e não confirma cadastros existentes.
            </p>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setStatus("idle");
                setMessage("");
              }}
            >
              Solicitar para outro e-mail
            </button>
          </div>
        ) : (
          <>
            <p className="eyebrow">Seu ponto de partida</p>
            <h2 id="form-title">
              {mode === "start" ? "Comece por aqui" : "Continue de onde parou"}
            </h2>
            <p className="panel-intro">
              {mode === "start"
                ? "Informe seus dados para criarmos um simulador exclusivo e enviarmos o acesso pessoal."
                : "Informe o mesmo e-mail. Se houver um simulador em andamento, enviaremos um novo link seguro."}
            </p>
            <form
              onSubmit={submit}
              onChange={(event) => {
                if (event.target instanceof HTMLInputElement) clearFieldError(event.target.name);
              }}
              className="editorial-form"
              noValidate
            >
              <input
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="honeypot"
                aria-hidden="true"
              />
              {mode === "start" && (
                <label htmlFor="fullName">
                  <span>Nome completo</span>
                  <input
                    id="fullName"
                    name="fullName"
                    autoComplete="name"
                    placeholder="Como devemos chamar você?"
                    required
                    minLength={3}
                    aria-invalid={Boolean(fieldErrors.fullName)}
                    aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
                  />
                  <FieldError field="fullName" errors={fieldErrors} />
                </label>
              )}
              <label htmlFor="email">
                <span>E-mail</span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  required
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                />
                <FieldError field="email" errors={fieldErrors} />
              </label>
              {mode === "start" && (
                <>
                  <label htmlFor="emailConfirmation">
                    <span>Confirmar e-mail</span>
                    <input
                      id="emailConfirmation"
                      name="emailConfirmation"
                      type="email"
                      autoComplete="email"
                      placeholder="Digite novamente"
                      required
                      aria-invalid={Boolean(fieldErrors.emailConfirmation)}
                      aria-describedby={fieldErrors.emailConfirmation ? "emailConfirmation-error" : undefined}
                    />
                    <FieldError field="emailConfirmation" errors={fieldErrors} />
                  </label>
                  <label className="consent-row" htmlFor="consent">
                    <input
                      id="consent"
                      name="consent"
                      type="checkbox"
                      required
                      aria-invalid={Boolean(fieldErrors.consent)}
                      aria-describedby={fieldErrors.consent ? "consent-error" : undefined}
                    />
                    <span>
                      <Check aria-hidden="true" /> Autorizo o tratamento dos meus dados para elaboração deste simulador e comunicações relacionadas, conforme a política de privacidade.
                    </span>
                  </label>
                  <FieldError field="consent" errors={fieldErrors} />
                </>
              )}
              {status === "error" && (
                <p className="form-error" role="alert">
                  {message}
                </p>
              )}
              <Button disabled={status === "sending"} type="submit">
                {status === "sending"
                  ? "Enviando…"
                  : mode === "start"
                    ? "Iniciar meu simulador"
                    : "Enviar link para continuar"}
                <ArrowRight aria-hidden="true" />
              </Button>
            </form>
            <Button variant="ghost" className="text-button" type="button" onClick={switchMode}>
              {mode === "start" ? "Já comecei meu simulador" : "Quero iniciar um novo simulador"}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
