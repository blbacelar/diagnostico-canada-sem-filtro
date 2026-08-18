import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportDocument } from "../../../components/ReportDocument";
import { getAdminSupabase } from "../../../lib/supabase";
import { getReportData, type ReportData } from "../../../lib/report";
import { hashFormToken } from "../../../lib/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resultado final do simulador", robots: { index: false, follow: false } };

async function loadPublicReport(token: string): Promise<ReportData | null> {
  try {
    const admin = getAdminSupabase();
    const { data } = await admin.from("diagnostic_report_tokens").select("id,case_id,expires_at,revoked_at").eq("token_hash", hashFormToken(token)).maybeSingle();
    if (!data || data.revoked_at || new Date(data.expires_at) <= new Date()) return null;
    await admin.from("diagnostic_report_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
    return await getReportData(admin, data.case_id);
  } catch { return null; }
}

export default async function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await loadPublicReport(token);
  if (!report) notFound();
  return <ReportDocument report={report} />;
}
