import { handleApiError, json, requireConsultant } from "../../../../lib/api";

export async function GET(request: Request) {
  try {
    const { admin } = await requireConsultant(request);
    const { data, error } = await admin
      .from("diagnostic_audit_logs")
      .select("id,case_id,actor_type,action,created_at,diagnostic_cases(case_number)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const items = (data ?? []).map((item) => {
      const relatedCase = item.diagnostic_cases as unknown as { case_number: string } | Array<{ case_number: string }> | null;
      return {
        id: item.id,
        case_id: item.case_id,
        actor_type: item.actor_type,
        action: item.action,
        created_at: item.created_at,
        case_number: Array.isArray(relatedCase) ? relatedCase[0]?.case_number ?? null : relatedCase?.case_number ?? null,
      };
    });
    return json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
