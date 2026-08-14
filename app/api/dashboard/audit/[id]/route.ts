import { ApiError, handleApiError, json, requireConsultant } from "../../../../../lib/api";

type DiagnosticCaseRow = {
  id: string;
  case_number: string;
  status: string;
  objective: string | null;
  client_id: string;
  submitted_at: string | null;
  updated_at: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { admin } = await requireConsultant(request);

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

    if (audit.case_id) {
      const { data: caseRow, error: caseError } = await admin
        .from("diagnostic_cases")
        .select("id,case_number,status,objective,client_id,submitted_at,updated_at")
        .eq("id", audit.case_id)
        .maybeSingle();
      if (caseError) throw caseError;
      diagnosticCase = (caseRow ?? null) as DiagnosticCaseRow | null;

      if (diagnosticCase?.client_id) {
        const [clientResult, purchasesResult] = await Promise.all([
          admin
            .from("clients")
            .select("id,name,email,phone,document,country,zip_code,city,state,address,district,number,complement,status_journey,created_at,updated_at")
            .eq("id", diagnosticCase.client_id)
            .maybeSingle(),
          admin
            .from("purchases")
            .select("id,transaction_code,product_name,price_gross,price_net,status_hotmart,purchase_date,created_at")
            .eq("client_id", diagnosticCase.client_id)
            .order("purchase_date", { ascending: false }),
        ]);
        if (clientResult.error) throw clientResult.error;
        if (purchasesResult.error) throw purchasesResult.error;
        client = clientResult.data ?? null;
        purchases = purchasesResult.data ?? [];
      }
    }

    return json({
      audit,
      case: diagnosticCase,
      client,
      purchases,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
