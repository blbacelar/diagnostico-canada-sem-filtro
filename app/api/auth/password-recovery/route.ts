import { ZodError } from "zod";
import { ApiError, enforceRateLimit, handleApiError, json, parseJson } from "../../../../lib/api";
import { sendPasswordRecoveryEmail } from "../../../../lib/email";
import { passwordRecoveryRequestSchema } from "../../../../lib/schemas";
import { getAdminSupabase } from "../../../../lib/supabase";

const neutralMessage = "Se a conta estiver ativa, enviaremos as instruções de recuperação.";

async function sendRecoveryFallback(admin: ReturnType<typeof getAdminSupabase>, email: string, resetUrl: string) {
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
  if (error) {
    console.error("password_recovery_fallback_failed", error.name, error.message);
  }
}

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "password_recovery", 5, 15);
    const payload = await parseJson(request, passwordRecoveryRequestSchema, 10_000);
    if (payload.website) return json({ message: neutralMessage });

    const admin = getAdminSupabase();
    const resetUrl = new URL("/recuperar-senha/confirmar", new URL(request.url).origin);
    resetUrl.searchParams.set("recovery", "1");
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: payload.email,
    });

    if (error || !data.properties.hashed_token) {
      console.error("password_recovery_link_failed", error?.name ?? "missing_token", error?.message ?? "no_message");
      await sendRecoveryFallback(admin, payload.email, resetUrl.toString());
      return json({ message: neutralMessage });
    }

    resetUrl.searchParams.set("recovery", "1");
    resetUrl.searchParams.set("token_hash", data.properties.hashed_token);

    const result = await sendPasswordRecoveryEmail({
      to: payload.email,
      resetUrl: resetUrl.toString(),
    });
    if (result.error) {
      console.error("password_recovery_email_failed", result.error.name);
      await sendRecoveryFallback(admin, payload.email, resetUrl.toString());
    }

    return json({ message: neutralMessage });
  } catch (error) {
    if (error instanceof ApiError || error instanceof ZodError || error instanceof SyntaxError) {
      return handleApiError(error);
    }
    console.error("password_recovery_failed", error instanceof Error ? error.name : "unknown");
    return json({ message: neutralMessage });
  }
}
