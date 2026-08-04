"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { getBrowserSupabase } from "../lib/supabase";
import { passwordResetSchema } from "../lib/schemas";
import { Button } from "./ui/button";

type RecoveryState = "checking" | "ready" | "invalid" | "success";

export function PasswordResetForm() {
  const [state, setState] = useState<RecoveryState>("checking");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function establishRecoverySession() {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get("recovery") !== "1") {
        if (active) setState("invalid");
        return;
      }

      const supabase = getBrowserSupabase();
      let session = null;
      const tokenHash = currentUrl.searchParams.get("token_hash");
      const code = currentUrl.searchParams.get("code");
      const hash = new URLSearchParams(currentUrl.hash.slice(1));

      if (tokenHash) {
        const result = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (result.error) {
          if (active) setState("invalid");
          return;
        }
        session = result.data.session;
      } else if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        if (result.error) {
          if (active) setState("invalid");
          return;
        }
        session = result.data.session;
      } else if (
        hash.get("type") === "recovery" &&
        hash.get("access_token") &&
        hash.get("refresh_token")
      ) {
        const result = await supabase.auth.setSession({
          access_token: hash.get("access_token")!,
          refresh_token: hash.get("refresh_token")!,
        });
        if (result.error) {
          if (active) setState("invalid");
          return;
        }
        session = result.data.session;
      } else {
        const result = await supabase.auth.getSession();
        session = result.data.session;
      }

      if (!session) {
        if (active) setState("invalid");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        if (active) setState("invalid");
        return;
      }

      window.history.replaceState({}, "", "/recuperar-senha/confirmar?recovery=1");
      if (active) setState("ready");
    }

    establishRecoverySession().catch(() => {
      if (active) setState("invalid");
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const result = passwordResetSchema.safeParse({
      password: String(form.get("password") ?? ""),
      passwordConfirmation: String(form.get("passwordConfirmation") ?? ""),
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Confira a nova senha.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const { error: updateError } = await supabase.auth.updateUser({
        password: result.data.password,
      });
      if (updateError) throw updateError;
      await supabase.auth.signOut({ scope: "global" });
      setState("success");
    } catch {
      setError("Não foi possível atualizar a senha. Solicite um novo link e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (state === "checking") {
    return (
      <div className="recovery-state" role="status">
        <LoaderCircle className="recovery-spinner" />
        <h3>Validando seu link</h3>
        <p>Isso leva apenas alguns segundos.</p>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="recovery-state recovery-state--error">
        <AlertTriangle />
        <h3>Este link não é mais válido</h3>
        <p>O link pode ter expirado ou já ter sido usado.</p>
        <Link className="primary-button" href="/recuperar-senha">
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="recovery-state recovery-state--success" role="status">
        <Check />
        <h3>Senha atualizada</h3>
        <p>Sua nova senha já pode ser usada para acessar o dashboard.</p>
        <Link className="primary-button" href="/login?reset=success">
          Ir para o login <ArrowRight />
        </Link>
      </div>
    );
  }

  return (
    <form className="login-form password-reset-form" onSubmit={submit} noValidate>
      <label>
        <span>
          <KeyRound /> Nova senha
        </span>
        <div className="password-field">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
            aria-invalid={Boolean(error)}
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </label>
      <label>
        <span>
          <KeyRound /> Confirme a nova senha
        </span>
        <div className="password-field">
          <input
            name="passwordConfirmation"
            type={showPasswordConfirmation ? "text" : "password"}
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
            aria-invalid={Boolean(error)}
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showPasswordConfirmation ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPasswordConfirmation((current) => !current)}
          >
            {showPasswordConfirmation ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </label>
      <p className="password-requirements">
        Use de 12 a 72 caracteres, com letra maiúscula, minúscula e número.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Atualizando…" : "Salvar nova senha"}
        <ArrowRight />
      </Button>
    </form>
  );
}
