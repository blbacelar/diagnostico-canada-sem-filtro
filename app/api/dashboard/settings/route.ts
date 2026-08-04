import { handleApiError, json, requireConsultant } from "../../../../lib/api";
import { operationalConfig } from "../../../../lib/operational-config";
import { publicSupabaseUrl } from "../../../../lib/supabase";

export async function GET(request: Request) {
  try {
    const { admin, consultant, user } = await requireConsultant(request);
    const [templates, content, cases, assessment] = await Promise.all([
      admin.from("diagnostic_email_templates").select("id", { count: "exact", head: true }).eq("active", true),
      admin.from("diagnostic_content_recommendations").select("id", { count: "exact", head: true }).eq("active", true),
      admin.from("diagnostic_cases").select("id", { count: "exact", head: true }).is("archived_at", null),
      admin.from("diagnostic_ai_assessments").select("methodology_version,model,status,created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    for (const result of [templates, content, cases, assessment]) if (result.error) throw result.error;

    return json({
      account: {
        display_name: consultant.display_name,
        email: user.email ?? "E-mail indisponível",
        role: consultant.role,
      },
      operation: {
        policy_version: operationalConfig.policyVersion,
        methodology_version: assessment.data?.methodology_version ?? operationalConfig.methodologyVersion,
        model: assessment.data?.model ?? process.env.OPEN_ROUTER_MODEL ?? "Modelo ainda não executado",
        form_link_days: operationalConfig.formLinkDays,
        report_link_days: operationalConfig.reportLinkDays,
        review_sla_hours: operationalConfig.reviewSlaHours,
        app_url: process.env.APP_URL ?? new URL(request.url).origin,
      },
      integrations: [
        { key: "database", label: "Banco de dados", provider: "Supabase", configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), detail: new URL(publicSupabaseUrl).hostname },
        { key: "email", label: "Envio de e-mails", provider: "Resend", configured: Boolean(process.env.RESEND_API_KEY), detail: process.env.EMAIL_FROM ?? "Remetente não configurado" },
        { key: "ai", label: "Análise estruturada", provider: "OpenRouter", configured: Boolean(process.env.OPEN_ROUTER_API_KEY), detail: assessment.data?.model ?? process.env.OPEN_ROUTER_MODEL ?? "Modelo padrão" },
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
