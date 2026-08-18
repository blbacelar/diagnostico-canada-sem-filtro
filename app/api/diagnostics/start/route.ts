import { startDiagnosticSchema } from "../../../../lib/schemas";
import { ApiError, enforceRateLimit, handleApiError, json, parseJson, requestIp, writeAudit } from "../../../../lib/api";
import { getAdminSupabase } from "../../../../lib/supabase";
import { createFormToken, hashFormToken, tokenCookie } from "../../../../lib/tokens";
import { sendContinuationEmail } from "../../../../lib/email";
import { newCaseNumber } from "../../../../lib/cases";
import { getOperationalConfig } from "../../../../lib/operational-config.server";
import { upsertCentralClient } from "../../../../lib/central-client";

const neutralMessage = "Se os dados puderem ser processados, você receberá um link pessoal para continuar. Confira também a pasta de spam.";

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, "diagnostic_start", 5, 15);
    const payload = await parseJson(request, startDiagnosticSchema, 20_000);
    if (payload.website) return json({ message: neutralMessage });
    const admin = getAdminSupabase();
    const operationalConfig = await getOperationalConfig(admin);
    const now = new Date().toISOString();
    const client = await upsertCentralClient(admin, {
      name: payload.fullName,
      email: payload.email,
      source: "hotmart",
    });
    const activeStatuses = ["client_draft", "submitted", "ai_processing", "awaiting_triage", "in_review", "awaiting_client", "ready_for_approval", "approved", "sending"];
    const { data: existingCase, error: caseReadError } = await admin.from("diagnostic_cases").select("id, case_number, status").eq("client_id", client.id).in("status", activeStatuses).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let diagnosticCase = existingCase;
    if (caseReadError) throw caseReadError;
    if (!diagnosticCase) {
      const { data, error } = await admin.from("diagnostic_cases").insert({ case_number: newCaseNumber(), client_id: client.id, status: "client_draft", source_metadata: { source: "hotmart", utm: payload.utm ?? {}, initial_ip_hash_present: requestIp(request) !== "unknown" } }).select("id, case_number, status").single();
      if (error) throw error; diagnosticCase = data;
      await admin.from("diagnostic_status_history").insert({ case_id: data.id, from_status: null, to_status: "client_draft", actor_type: "client", note: "Simulador iniciado pelo link público." });
    } else if (diagnosticCase.status !== "client_draft") {
      return json({ message: neutralMessage });
    }
    const token = createFormToken();
    await admin.from("diagnostic_access_tokens").update({ revoked_at: now }).eq("case_id", diagnosticCase.id).is("revoked_at", null);
    const { error: tokenError } = await admin.from("diagnostic_access_tokens").insert({ case_id: diagnosticCase.id, token_hash: hashFormToken(token), expires_at: new Date(Date.now() + operationalConfig.formLinkDays * 24 * 60 * 60 * 1000).toISOString() });
    if (tokenError) throw tokenError;
    await admin.from("diagnostic_consents").insert({ case_id: diagnosticCase.id, consent_type: "diagnostic_processing", policy_version: payload.policyVersion, granted: true, source: "hotmart" });
    const emailResult = await sendContinuationEmail({ to: client.email, fullName: client.name, caseNumber: diagnosticCase.case_number, token });
    const emailError = emailResult.error;
    await admin.from("diagnostic_email_deliveries").insert({ case_id: diagnosticCase.id, delivery_type: "continuation_link", recipient: client.email, subject: "Seu link pessoal — Simulador Canadá Sem Filtro", status: emailError ? "failed" : "sent", provider_id: emailResult.data?.id ?? null, error_code: emailError?.name ?? null, sent_at: emailError ? null : now });
    await writeAudit(admin, { caseId: diagnosticCase.id, actorType: "client", action: "diagnostic.started", metadata: { source: "hotmart", policyVersion: payload.policyVersion } });
    const response = json({ message: neutralMessage });
    response.headers.append("Set-Cookie", tokenCookie(token));
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return handleApiError(error);
    console.error("diagnostic_start_failed", error instanceof Error ? error.message : "unknown");
    return json({ message: neutralMessage });
  }
}
