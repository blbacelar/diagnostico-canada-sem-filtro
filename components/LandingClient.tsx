"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Clock3, LockKeyhole, Mail, Save } from "lucide-react";
import { sanitizedUtm } from "../lib/schemas";

type Mode = "start" | "resume";

export function LandingClient() {
  const [mode, setMode] = useState<Mode>("start");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = mode === "start"
      ? {
          fullName: form.get("fullName"),
          email: form.get("email"),
          emailConfirmation: form.get("emailConfirmation"),
          consent: form.get("consent") === "on",
          policyVersion: "2026-08-03",
          source: "hotmart",
          website: form.get("website"),
          utm: sanitizedUtm(new URLSearchParams(window.location.search)),
        }
      : { email: form.get("email"), website: form.get("website") };
    try {
      const response = await fetch(mode === "start" ? "/api/diagnostics/start" : "/api/diagnostics/resume-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string; message: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível enviar o link.");
      setMessage(data.message);
      setStatus("sent");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir agora.");
      setStatus("error");
    }
  }

  return (
    <div className="landing-grid">
      <section className="landing-copy" aria-labelledby="landing-title">
        <p className="eyebrow"><span /> Canadá sem filtro · diagnóstico</p>
        <h1 id="landing-title">Vamos entender o seu <em>projeto Canadá.</em></h1>
        <p className="lede">Um olhar honesto sobre o seu momento, suas escolhas e o que precisa acontecer antes do próximo passo.</p>
        <div className="landing-facts" aria-label="Informações sobre o diagnóstico">
          <div><Clock3 aria-hidden="true" /><span><small>Tempo estimado</small><strong>25–35 minutos</strong></span></div>
          <div><Save aria-hidden="true" /><span><small>Seu ritmo</small><strong>Salve e continue depois</strong></span></div>
          <div><LockKeyhole aria-hidden="true" /><span><small>Privacidade</small><strong>Link pessoal e seguro</strong></span></div>
        </div>
        <blockquote>“O objetivo não é encaixar sua vida em uma promessa pronta. É construir uma leitura responsável do caminho.”</blockquote>
      </section>

      <section className="start-panel" aria-labelledby="form-title">
        <div className="start-panel__counter">CSF / 01</div>
        {status === "sent" ? (
          <div className="sent-state" role="status">
            <span className="sent-state__icon"><Mail aria-hidden="true" /></span>
            <p className="eyebrow">Link solicitado</p>
            <h2>Agora, confira seu e-mail.</h2>
            <p>{message}</p>
            <p className="fine-print">Verifique também a pasta de spam. Por segurança, a mensagem é sempre neutra e não confirma cadastros existentes.</p>
            <button className="text-button" type="button" onClick={() => { setStatus("idle"); setMessage(""); }}>Solicitar para outro e-mail</button>
          </div>
        ) : (
          <>
            <p className="eyebrow">Seu ponto de partida</p>
            <h2 id="form-title">{mode === "start" ? "Comece por aqui" : "Continue de onde parou"}</h2>
            <p className="panel-intro">{mode === "start" ? "Informe seus dados para criarmos um diagnóstico exclusivo e enviarmos o acesso pessoal." : "Informe o mesmo e-mail. Se houver um diagnóstico em andamento, enviaremos um novo link seguro."}</p>
            <form onSubmit={submit} className="editorial-form" noValidate>
              <input name="website" tabIndex={-1} autoComplete="off" className="honeypot" aria-hidden="true" />
              {mode === "start" && (
                <label><span>Nome completo</span><input name="fullName" autoComplete="name" placeholder="Como devemos chamar você?" required minLength={3} /></label>
              )}
              <label><span>E-mail</span><input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required /></label>
              {mode === "start" && (
                <>
                  <label><span>Confirmar e-mail</span><input name="emailConfirmation" type="email" autoComplete="email" placeholder="Digite novamente" required /></label>
                  <label className="consent-row"><input name="consent" type="checkbox" required /><span><Check aria-hidden="true" /> Autorizo o tratamento dos meus dados para elaboração deste diagnóstico e comunicações relacionadas, conforme a política de privacidade.</span></label>
                </>
              )}
              {status === "error" && <p className="form-error" role="alert">{message}</p>}
              <button className="primary-button" disabled={status === "sending"} type="submit">
                {status === "sending" ? "Enviando…" : mode === "start" ? "Iniciar meu diagnóstico" : "Enviar link para continuar"}<ArrowRight aria-hidden="true" />
              </button>
            </form>
            <button className="text-button" type="button" onClick={() => { setMode(mode === "start" ? "resume" : "start"); setMessage(""); setStatus("idle"); }}>
              {mode === "start" ? "Já comecei meu diagnóstico" : "Quero iniciar um novo diagnóstico"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
