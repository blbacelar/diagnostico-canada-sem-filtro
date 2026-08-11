import { handleApiError, json, requireConsultant } from "../../../../lib/api";
import { buildClientList, type ClientCaseRecord, type ClientRecord } from "../../../../lib/clients";
import {
  attachPurchaseRecord,
  mapPurchaseWindowsByEmail,
  type AllowedEmailEventRow,
  type PurchaseRecordRow,
} from "../../../../lib/purchase-window";

const clientColumns = "id,name,email,created_at,updated_at";

type CentralClientRow = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
};

function toLegacyClient(client: CentralClientRow): ClientRecord {
  return {
    ...client,
    full_name: client.name,
    email_normalized: client.email,
    email_display: client.email,
    source: "diagnostic",
  } as ClientRecord;
}

export async function GET(request: Request) {
  try {
    const { admin } = await requireConsultant(request);
    const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, 120) ?? "";
    let clients: ClientRecord[] = [];

    if (search) {
      const pattern = `%${search}%`;
      const [nameResult, emailResult] = await Promise.all([
        admin.from("clients").select(clientColumns).ilike("name", pattern).order("updated_at", { ascending: false }).limit(100),
        admin.from("clients").select(clientColumns).ilike("email", pattern.toLowerCase()).order("updated_at", { ascending: false }).limit(100),
      ]);
      if (nameResult.error) throw nameResult.error;
      if (emailResult.error) throw emailResult.error;
      clients = [...new Map([...(nameResult.data ?? []), ...(emailResult.data ?? [])].map((client) => [client.id, toLegacyClient(client)])).values()].slice(0, 100);
    } else {
      const result = await admin.from("clients").select(clientColumns).order("updated_at", { ascending: false }).limit(100);
      if (result.error) throw result.error;
      clients = (result.data ?? []).map(toLegacyClient);
    }

    if (!clients.length) return json({ items: [] });

    const { data: cases, error: casesError } = await admin
      .from("diagnostic_cases")
      .select("id,client_id,case_number,status,objective,submitted_at,updated_at,archived_at")
      .in("client_id", clients.map((client) => client.id))
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (casesError) throw casesError;

    const normalizedEmails = [...new Set(clients.map((client) => client.email_normalized.toLowerCase()))];
    const { data: purchaseRows, error: purchaseError } = await admin
      .from("allowed_emails")
      .select("email,last_event,created_at,updated_at,last_event_at,external_reference,active")
      .in("email", normalizedEmails)
      .eq("active", true)
      .order("last_event_at", { ascending: false })
      .limit(500);
    if (purchaseError) throw purchaseError;

    const { data: purchaseRecords, error: purchaseRecordsError } = await admin
      .from("purchases")
      .select("client_id,transaction_code,status_hotmart,purchase_date,created_at")
      .in("client_id", clients.map((client) => client.id))
      .order("purchase_date", { ascending: true })
      .limit(500);
    if (purchaseRecordsError) throw purchaseRecordsError;

    const earliestPurchaseByClientId = new Map<string, PurchaseRecordRow>();
    const purchaseByTransaction = new Map<string, PurchaseRecordRow>();
    for (const purchase of (purchaseRecords ?? []) as PurchaseRecordRow[]) {
      if (purchase.transaction_code) purchaseByTransaction.set(purchase.transaction_code, purchase);
      if (purchase.client_id && !earliestPurchaseByClientId.has(purchase.client_id)) {
        earliestPurchaseByClientId.set(purchase.client_id, purchase);
      }
    }

    const clientIdByEmail = new Map(clients.map((client) => [client.email_normalized.toLowerCase(), client.id]));
    const purchaseRowsWithRealDates = ((purchaseRows ?? []) as AllowedEmailEventRow[]).map((row) => {
      const purchase =
        (row.external_reference ? purchaseByTransaction.get(row.external_reference) : null) ??
        earliestPurchaseByClientId.get(clientIdByEmail.get(row.email.toLowerCase()) ?? "");
      return attachPurchaseRecord(row, purchase);
    });

    const purchaseByEmail = mapPurchaseWindowsByEmail(purchaseRowsWithRealDates);

    return json({ items: buildClientList(clients, (cases ?? []) as ClientCaseRecord[], purchaseByEmail) });
  } catch (error) {
    return handleApiError(error);
  }
}
