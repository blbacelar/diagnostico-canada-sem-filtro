import { z } from "zod";
import { ApiError, handleApiError, json, parseJson } from "../../../../lib/api";
import { getAdminSupabase, getSupabaseForAccessToken } from "../../../../lib/supabase";
import { getCentralClientById } from "../../../../lib/central-client";
import { hasPurchasedAccessForEmail } from "../../../../lib/purchase-window";
import { getOperationalConfig } from "../../../../lib/operational-config.server";
import { createFormToken, hashFormToken, tokenCookie } from "../../../../lib/tokens";

const schema = z.object({ caseId: z.string().uuid() }).strict();

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ") || !auth.slice(7).trim()) throw new ApiError(401, "Faça login para continuar.", "AUTH_REQUIRED");
    const { data: authData, error: authError } = await getSupabaseForAccessToken(auth.slice(7).trim()).auth.getUser();
    if (authError || !authData.user) throw new ApiError(401, "Sua sessão expirou.", "AUTH_REQUIRED");
    const admin = getAdminSupabase();
    const { data: link, error: linkError } = await admin.from("csf_diagnostic_user_links").select("client_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (linkError) throw linkError;
    if (!link) throw new ApiError(403, "Seu acesso ao diagnóstico ainda precisa ser confirmado.", "LINK_REQUIRED");
    const client = await getCentralClientById(admin, link.client_id);
    if (!client?.email || !(await hasPurchasedAccessForEmail(admin, client.email))) throw new ApiError(403, "Seu acesso ao diagnóstico ainda precisa ser confirmado.", "ACCESS_REQUIRED");
    const { data: cases, error: casesError } = await admin.from("diagnostic_cases").select("id,case_number").eq("client_id", link.client_id).eq("status", "client_draft").is("archived_at", null);
    if (casesError) throw casesError;
    return json({ cases: cases ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

// Esta rota só aceita um vínculo explícito, criado por um processo de
// comprovação de titularidade. Não associa contas por e-mail.
export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) throw new ApiError(401, "Faça login para continuar.", "AUTH_REQUIRED");
    const accessToken = auth.slice(7).trim();
    if (!accessToken) throw new ApiError(401, "Faça login para continuar.", "AUTH_REQUIRED");
    const { data: authData, error: authError } = await getSupabaseForAccessToken(accessToken).auth.getUser();
    if (authError || !authData.user) throw new ApiError(401, "Sua sessão expirou.", "AUTH_REQUIRED");

    const { caseId } = await parseJson(request, schema, 1024);
    const admin = getAdminSupabase();
    const { data: link, error: linkError } = await admin.from("csf_diagnostic_user_links").select("client_id").eq("auth_user_id", authData.user.id).maybeSingle();
    if (linkError) throw linkError;
    if (!link) throw new ApiError(403, "Seu acesso ao diagnóstico ainda precisa ser confirmado.", "LINK_REQUIRED");

    const { data: diagnosticCase, error: caseError } = await admin.from("diagnostic_cases").select("id,status,archived_at").eq("id", caseId).eq("client_id", link.client_id).maybeSingle();
    if (caseError) throw caseError;
    if (!diagnosticCase || diagnosticCase.archived_at || diagnosticCase.status !== "client_draft") {
      throw new ApiError(404, "Não encontramos um formulário disponível para esta conta.", "CASE_UNAVAILABLE");
    }
    const client = await getCentralClientById(admin, link.client_id);
    if (!client?.email || !(await hasPurchasedAccessForEmail(admin, client.email))) {
      throw new ApiError(403, "Seu acesso ao diagnóstico ainda precisa ser confirmado.", "ACCESS_REQUIRED");
    }

    const config = await getOperationalConfig(admin);
    const token = createFormToken();
    const { error: tokenError } = await admin.from("diagnostic_access_tokens").insert({
      case_id: diagnosticCase.id,
      token_hash: hashFormToken(token),
      expires_at: new Date(Date.now() + config.formLinkDays * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (tokenError) throw tokenError;
    const response = json({ ok: true });
    response.headers.append("Set-Cookie", tokenCookie(token));
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
