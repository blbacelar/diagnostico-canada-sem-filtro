"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "../lib/supabase";

export function LoginForm({ recovery = false }: { recovery?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    try {
      if (recovery) {
        const { error: resetError } = await getBrowserSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
        if (resetError) throw resetError;
        setMessage("Se a conta estiver ativa, enviaremos as instruções de recuperação.");
      } else {
        const password = String(form.get("password") ?? "");
        const { error: signInError } = await getBrowserSupabase().auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.replace("/dashboard"); router.refresh();
      }
    } catch { setError(recovery ? "Não foi possível solicitar a recuperação agora." : "E-mail ou senha inválidos, ou conta sem acesso."); }
    finally { setLoading(false); }
  }

  return <form className="login-form" onSubmit={submit}>
    <label><span><Mail /> E-mail profissional</span><input name="email" type="email" autoComplete="email" required placeholder="consultora@exemplo.com" /></label>
    {!recovery && <label><span><KeyRound /> Senha</span><input name="password" type="password" autoComplete="current-password" required placeholder="Sua senha" /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <button className="primary-button" disabled={loading}>{loading ? "Aguarde…" : recovery ? "Enviar instruções" : "Entrar no dashboard"}<ArrowRight /></button>
  </form>;
}
