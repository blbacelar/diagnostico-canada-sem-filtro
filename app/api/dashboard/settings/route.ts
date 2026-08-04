import { ApiError, handleApiError, json, parseJson, requireConsultant, writeAudit } from "../../../../lib/api";
import { operationalSettingsUpdateSchema } from "../../../../lib/operational-config";
import { getOperationalSettingsRecord } from "../../../../lib/operational-config.server";
import { publicSupabaseUrl } from "../../../../lib/supabase";

const settingsColumns = "policy_version,methodology_version,prompt_version,model,form_link_days,report_link_days,review_sla_hours,revision,updated_at";

export async function GET(request: Request) {
  try {
    const { admin, consultant, user } = await requireConsultant(request);
    const [templates, content, cases, assessment, operation] = await Promise.all([
      admin.from("diagnostic_email_templates").select("id", { count: "exact", head: true }).eq("active", true),
      admin.from("diagnostic_content_recommendations").select("id", { count: "exact", head: true }).eq("active", true),
      admin.from("diagnostic_cases").select("id", { count: "exact", head: true }).is("archived_at", null),
      admin.from("diagnostic_ai_assessments").select("model,status,created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      getOperationalSettingsRecord(admin),
    ]);
    for (const result of [templates, content, cases, assessment]) if (result.error) throw result.error;

    return json({
      account: {
        display_name: consultant.display_name,
        email: user.email ?? "E-mail indisponível",
        role: consultant.role,
      },
      editable: consultant.role === "admin",
      operation: {
        ...operation,
        app_url: process.env.APP_URL ?? new URL(request.url).origin,
      },
      integrations: [
        { key: "database", label: "Banco de dados", provider: "Supabase", configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), detail: new URL(publicSupabaseUrl).hostname },
        { key: "email", label: "Envio de e-mails", provider: "Resend", configured: Boolean(process.env.RESEND_API_KEY), detail: process.env.EMAIL_FROM ?? "Remetente não configurado" },
        { key: "ai", label: "Análise estruturada", provider: "OpenRouter", configured: Boolean(process.env.OPEN_ROUTER_API_KEY), detail: assessment.data?.model ?? operation.model },
      ],
      counts: {
        active_templates: templates.count ?? 0,
        active_content: content.count ?? 0,
        open_cases: cases.count ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, user } = await requireConsultant(request, "admin");
    const payload = await parseJson(request, operationalSettingsUpdateSchema, 10_000);
    const { revision, ...values } = payload;
    const { data, error } = await admin
      .from("diagnostic_operational_settings")
      .update({ ...values, updated_by: user.id })
      .eq("id", 1)
      .eq("revision", revision)
      .select(settingsColumns)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(409, "As configurações foram alteradas por outra pessoa. Recarregue a página.", "STALE_SETTINGS");

    await writeAudit(admin, {
      actorUserId: user.id,
      actorType: "consultant",
      action: "settings.updated",
      metadata: { previousRevision: revision, revision: data.revision, changedFields: Object.keys(values) },
    });
    return json({ operation: data });
  } catch (error) {
    return handleApiError(error);
  }
}
