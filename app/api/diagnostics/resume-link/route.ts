import { resumeLinkSchema } from "../../../../lib/schemas";
import { enforceRateLimit, handleApiError, json, parseJson, writeAudit } from "../../../../lib/api";
import { getAdminSupabase } from "../../../../lib/supabase";
import { createFormToken, hashFormToken } from "../../../../lib/tokens";
import { sendContinuationEmail } from "../../../../lib/email";
import { getOperationalConfig } from "../../../../lib/operational-config.server";

const neutralMessage = "Se encontrarmos um diagnóstico em andamento para este e-mail, você receberá um link para continuar.";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "diagnostic_resume", 5, 15);
    const payload = await parseJson(request, resumeLinkSchema, 10_000);
    if (payload.website) return json({ message: neutralMessage });
    const admin = getAdminSupabase();
    const { data: client } = await admin.from("diagnostic_clients").select("id,full_name,email_normalized").eq("email_normalized", payload.email).maybeSingle();
    if (!client) return json({ message: neutralMessage });
    const { data: diagnosticCase } = await admin.from("diagnostic_cases").select("id,case_number,status").eq("client_id", client.id).eq("status", "client_draft").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!diagnosticCase) return json({ message: neutralMessage });
    const config = await getOperationalConfig(admin);
    const token = createFormToken();
    await admin.from("diagnostic_access_tokens").update({ revoked_at: new Date().toISOString() }).eq("case_id", diagnosticCase.id).is("revoked_at", null);
    await admin.from("diagnostic_access_tokens").insert({ case_id: diagnosticCase.id, token_hash: hashFormToken(token), expires_at: new Date(Date.now() + config.formLinkDays * 24 * 60 * 60 * 1000).toISOString() });
    const result = await sendContinuationEmail({ to: client.email_normalized, fullName: client.full_name, caseNumber: diagnosticCase.case_number, token });
    await admin.from("diagnostic_email_deliveries").insert({ case_id: diagnosticCase.id, delivery_type: "continuation_link", recipient: client.email_normalized, subject: "Seu link pessoal — Diagnóstico Canadá Sem Filtro", status: result.error ? "failed" : "sent", provider_id: result.data?.id ?? null, error_code: result.error?.name ?? null, sent_at: result.error ? null : new Date().toISOString() });
    await writeAudit(admin, { caseId: diagnosticCase.id, actorType: "client", action: "form_link.renewed", metadata: { formLinkDays: config.formLinkDays } });
    return json({ message: neutralMessage });
  } catch (error) {
    if (error instanceof Error) console.error("resume_link_failed", error.message);
    return error instanceof SyntaxError ? handleApiError(error) : json({ message: neutralMessage });
  }
}
