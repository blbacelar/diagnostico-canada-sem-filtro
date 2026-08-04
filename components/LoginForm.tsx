"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "../lib/supabase";
import { Button } from "./ui/button";

export function LoginForm({
  recovery = false,
  passwordReset = false,
}: { recovery?: boolean; passwordReset?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    passwordReset ? "Senha atualizada. Entre com sua nova senha." : "",
  );
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();

    try {
      if (recovery) {
        const response = await fetch("/api/auth/password-recovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!response.ok) throw new Error("password_recovery_request_failed");
        setMessage("Se a conta estiver ativa, enviaremos as instruções de recuperação.");
      } else {
        const password = String(form.get("password") ?? "");
        const { data: signInData, error: signInError } = await getBrowserSupabase().auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        const accessToken = signInData.session?.access_token;
        if (!accessToken) throw new Error("missing_access_token");
        const sessionResponse = await fetch("/api/auth/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!sessionResponse.ok) throw new Error("dashboard_session_sync_failed");
        router.replace("/dashboard");
        router.refresh();
      }
    } catch {
      setError(
        recovery
          ? "Não foi possível solicitar a recuperação agora."
          : "E-mail ou senha inválidos, ou conta sem acesso.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        <span>
          <Mail /> E-mail profissional
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="consultora@exemplo.com"
        />
      </label>
      {!recovery && (
        <label>
          <span>
            <KeyRound /> Senha
          </span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Sua senha"
          />
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Aguarde…" : recovery ? "Enviar instruções" : "Entrar no dashboard"}
        <ArrowRight />
      </Button>
    </form>
  );
}
