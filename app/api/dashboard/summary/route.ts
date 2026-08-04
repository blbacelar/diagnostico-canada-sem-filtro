/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase infers nested relation payloads at runtime. */
import { handleApiError, json, requireConsultant } from "../../../../lib/api";
import { buildDashboardSummary } from "../../../../lib/dashboard-summary";
import { getOperationalConfig } from "../../../../lib/operational-config.server";
import { decorateCaseLocks } from "../../../../lib/case-lock";

export async function GET(request: Request) {
  try {
    const { admin, user } = await requireConsultant(request);
    const [casesResult, historyResult, config] = await Promise.all([
      admin.from("diagnostic_cases").select("id,case_number,status,objective,submitted_at,updated_at,assigned_consultant_id,diagnostic_clients(full_name,email_display),diagnostic_ai_assessments(version,structured_result,status)").is("archived_at", null).order("updated_at", { ascending: false }).limit(100),
      admin.from("diagnostic_status_history").select("case_id,to_status,created_at,diagnostic_cases(submitted_at)").eq("to_status", "in_review").order("created_at", { ascending: false }).limit(100),
      getOperationalConfig(admin),
    ]);
    if (casesResult.error) throw casesResult.error;
    if (historyResult.error) throw historyResult.error;
    const cases = await decorateCaseLocks(admin, casesResult.data ?? [], user.id);
    const summary = buildDashboardSummary(cases);
    const recent = summary.recent
      .slice(0, 6)
      .map((item: any) => ({ ...item, diagnostic_ai_assessments: [...(item.diagnostic_ai_assessments ?? [])].sort((a: any, b: any) => b.version - a.version).slice(0, 1) }));
    const durations = (historyResult.data ?? []).flatMap((event: any) => {
      const submitted = Array.isArray(event.diagnostic_cases) ? event.diagnostic_cases[0]?.submitted_at : event.diagnostic_cases?.submitted_at;
      return submitted ? [Math.max(0, (new Date(event.created_at).getTime() - new Date(submitted).getTime()) / 3_600_000)] : [];
    });
    const averageHours = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
    return json({ counts: summary.counts, recent, averageHours, reviewSlaHours: config.reviewSlaHours });
  } catch (error) {
    return handleApiError(error);
  }
}
