import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError, enforceRateLimit, handleApiError, json, parseJson, requireFormCase } from "../../../../lib/api";
import { getSupabaseForAccessToken } from "../../../../lib/supabase";
import { getCentralClientById } from "../../../../lib/central-client";
import { sendPortalLinkCode } from "../../../../lib/email";
import { hashFormToken } from "../../../../lib/tokens";

// O vínculo exige a conta autenticada, o caso e um código enviado ao e-mail
// do cadastro existente. Cookie de caso ou e-mail informado não bastam.
async function verifiedContext(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ") || !auth.slice(7).trim()) throw new ApiError(401, "Faça login para continuar.", "AUTH_REQUIRED");
  const { data: identity, error: authError } = await getSupabaseForAccessToken(auth.slice(7).trim()).auth.getUser();
  if (authError || !identity.user) throw new ApiError(401, "Sua sessão expirou.", "AUTH_REQUIRED");
  const cookie = request.headers.get("cookie") ?? "";
  if (!/(?:^|;\s*)diagnostic_form_token=[^;]+/.test(cookie)) throw new ApiError(401, "Abra seu link pessoal do diagnóstico para continuar.", "CASE_PROOF_REQUIRED");
  const { admin, caseRow } = await requireFormCase(new Request(request.url, { method: "GET", headers: { cookie } }));
  const client = await getCentralClientById(admin, caseRow.client_id);
  if (!identity.user.email || !client?.email || identity.user.email.trim().toLowerCase() !== client.email.trim().toLowerCase()) {
    throw new ApiError(403, "Não foi possível confirmar este vínculo. Entre em contato com a equipe.", "LINK_PROOF_REQUIRED");
  }
  return { admin, userId: identity.user.id, clientId: caseRow.client_id, email: client.email };
}

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "portal_link_send", 5, 15);
    const { admin, userId, clientId, email } = await verifiedContext(request);
    const code = randomBytes(12).toString("base64url");
    const { error } = await admin.from("csf_diagnostic_link_challenges").insert({ auth_user_id: userId, client_id: clientId, code_hash: hashFormToken(code), expires_at: new Date(Date.now() + 600_000).toISOString() });
    if (error) throw error;
    const result = await sendPortalLinkCode({ to: email, code });
    if (result.error) throw result.error;
    return json({ ok: true });
  } catch (error) { return handleApiError(error); }
}

export async function PUT(request: Request) {
  try {
    await enforceRateLimit(request, "portal_link_verify", 10, 15);
    const { code } = await parseJson(request, z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{16}$/) }).strict(), 1024);
    const { admin, userId, clientId } = await verifiedContext(request);
    const now = new Date().toISOString();
    const { data: challenge, error: challengeError } = await admin.from("csf_diagnostic_link_challenges").update({ used_at: now }).eq("auth_user_id", userId).eq("client_id", clientId).eq("code_hash", hashFormToken(code)).is("used_at", null).gt("expires_at", now).select("id").maybeSingle();
    if (challengeError) throw challengeError;
    if (!challenge) throw new ApiError(400, "Código inválido ou expirado.", "INVALID_CODE");
    const { error } = await admin.from("csf_diagnostic_user_links").insert({ auth_user_id: userId, client_id: clientId });
    if (error && error.code !== "23505") throw error;
    if (error) {
      const { data: existing, error: readError } = await admin.from("csf_diagnostic_user_links").select("client_id").eq("auth_user_id", userId).maybeSingle();
      if (readError) throw readError;
      if (!existing || existing.client_id !== clientId) throw new ApiError(409, "Não foi possível confirmar este vínculo. Entre em contato com a equipe.", "LINK_CONFLICT");
    }
    return json({ ok: true });
  } catch (error) { return handleApiError(error); }
}
