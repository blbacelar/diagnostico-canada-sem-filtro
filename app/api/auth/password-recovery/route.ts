import { ZodError } from "zod";
import { ApiError, enforceRateLimit, handleApiError, json, parseJson } from "../../../../lib/api";
import { sendPasswordRecoveryEmail } from "../../../../lib/email";
import { passwordRecoveryRequestSchema } from "../../../../lib/schemas";
import { getAdminSupabase } from "../../../../lib/supabase";

const neutralMessage = "Se a conta estiver ativa, enviaremos as instruções de recuperação.";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "password_recovery", 5, 15);
    const payload = await parseJson(request, passwordRecoveryRequestSchema, 10_000);
    if (payload.website) return json({ message: neutralMessage });

    const admin = getAdminSupabase();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: payload.email,
    });

    if (error || !data.properties.hashed_token) {
      console.error("password_recovery_link_failed", error?.name ?? "missing_token");
      return json({ message: neutralMessage });
    }

    const resetUrl = new URL("/recuperar-senha/confirmar", new URL(request.url).origin);
    resetUrl.searchParams.set("recovery", "1");
    resetUrl.searchParams.set("token_hash", data.properties.hashed_token);

    const result = await sendPasswordRecoveryEmail({
      to: payload.email,
      resetUrl: resetUrl.toString(),
    });
    if (result.error) console.error("password_recovery_email_failed", result.error.name);

    return json({ message: neutralMessage });
  } catch (error) {
    if (error instanceof ApiError || error instanceof ZodError || error instanceof SyntaxError) {
      return handleApiError(error);
    }
    console.error("password_recovery_failed", error instanceof Error ? error.name : "unknown");
    return json({ message: neutralMessage });
  }
}
