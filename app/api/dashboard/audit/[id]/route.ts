import { ApiError, handleApiError, json, requireConsultant } from "../../../../../lib/api";
import { getCentralClientById } from "../../../../../lib/central-client";

type DiagnosticCaseRow = {
  id: string;
  case_number: string;
  status: string;
  objective: string | null;
  client_id: string;
  submitted_at: string | null;
  updated_at: string;
};

type AuditEventRow = {
  id: string;
  case_id: string | null;
  actor_type: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const DEFAULT_EVENTS_LIMIT = 10;
const MAX_EVENTS_LIMIT = 50;

function boundedInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(Math.floor(parsed), max));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { admin } = await requireConsultant(request);
    const searchParams = new URL(request.url).searchParams;
    const eventsOffset = boundedInteger(searchParams.get("eventsOffset"), 0, 10_000);
    const eventsLimit = boundedInteger(searchParams.get("eventsLimit"), DEFAULT_EVENTS_LIMIT, MAX_EVENTS_LIMIT);

    const { data: audit, error: auditError } = await admin
      .from("diagnostic_audit_logs")
      .select("id,case_id,actor_type,action,metadata,created_at")
      .eq("id", id)
      .maybeSingle();
    if (auditError) throw auditError;
    if (!audit) throw new ApiError(404, "Evento de auditoria não encontrado.", "AUDIT_NOT_FOUND");

    let diagnosticCase: DiagnosticCaseRow | null = null;
    let client = null;
    let purchases: unknown[] = [];
    let events: AuditEventRow[] = [audit as AuditEventRow];
    let eventsTotal = 1;

    if (audit.case_id) {
      const [caseResult, eventsResult] = await Promise.all([
        admin
          .from("diagnostic_cases")
          .select("id,case_number,status,objective,client_id,submitted_at,updated_at")
          .eq("id", audit.case_id)
          .maybeSingle(),
        admin
          .from("diagnostic_audit_logs")
          .select("id,case_id,actor_type,action,metadata,created_at", { count: "exact" })
          .eq("case_id", audit.case_id)
          .order("created_at", { ascending: false })
          .range(eventsOffset, eventsOffset + eventsLimit - 1),
      ]);
      const { data: caseRow, error: caseError } = caseResult;
      if (caseError) throw caseError;
      if (eventsResult.error) throw eventsResult.error;
      diagnosticCase = (caseRow ?? null) as DiagnosticCaseRow | null;
      events = (eventsResult.data ?? []) as AuditEventRow[];
      eventsTotal = eventsResult.count ?? events.length;

      if (diagnosticCase?.client_id) {
        const [clientResult, purchasesResult] = await Promise.all([
          getCentralClientById(admin, diagnosticCase.client_id),
          admin
            .from("purchases")
            .select("id,transaction_code,product_name,price_gross,price_net,status_hotmart,purchase_date,created_at")
            .eq("client_id", diagnosticCase.client_id)
            .order("purchase_date", { ascending: false }),
        ]);
        if (purchasesResult.error && purchasesResult.error.code !== "PGRST205") throw purchasesResult.error;
        client = clientResult
          ? {
              id: clientResult.id,
              name: clientResult.name,
              email: clientResult.email,
              created_at: clientResult.created_at,
              updated_at: clientResult.updated_at,
            }
          : null;
        purchases = purchasesResult.error ? [] : purchasesResult.data ?? [];
      }
    }

    return json({
      audit,
      events: {
        items: events,
        total: eventsTotal,
        offset: eventsOffset,
        limit: eventsLimit,
        has_more: eventsOffset + events.length < eventsTotal,
        next_offset: eventsOffset + events.length,
      },
      case: diagnosticCase,
      client,
      purchases,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
