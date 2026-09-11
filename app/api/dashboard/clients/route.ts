import { handleApiError, json, requireConsultant } from "../../../../lib/api";
import { buildClientList, type ClientCaseRecord, type ClientRecord } from "../../../../lib/clients";
import { listCentralClients, searchCentralClients, type CentralClient } from "../../../../lib/central-client";
import {
  attachPurchaseRecord,
  mapPurchaseWindowsByEmail,
  type AllowedEmailEventRow,
  type PurchaseRecordRow,
} from "../../../../lib/purchase-window";

function toLegacyClient(client: CentralClient): ClientRecord {
  return {
    id: client.id,
    full_name: client.name,
    email_normalized: client.email,
    email_display: client.email,
    source: client.source ?? "diagnostic",
    created_at: client.created_at ?? "",
    updated_at: client.updated_at ?? "",
  } as ClientRecord;
}

export async function GET(request: Request) {
  try {
    const { admin } = await requireConsultant(request);
    const searchParams = new URL(request.url).searchParams;
    const search = searchParams.get("search")?.trim().slice(0, 120) ?? "";
    const status = searchParams.get("status")?.trim().slice(0, 80) ?? "";
    let clients: ClientRecord[] = [];

    if (search) {
      clients = (await searchCentralClients(admin, search, 100)).map(toLegacyClient);
    } else {
      clients = (await listCentralClients(admin, 100)).map(toLegacyClient);
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
      .select("client_id,transaction_code,product_name,status_hotmart,purchase_date,created_at")
      .in("client_id", clients.map((client) => client.id))
      .order("purchase_date", { ascending: true })
      .limit(500);
    if (purchaseRecordsError && purchaseRecordsError.code !== "PGRST205") throw purchaseRecordsError;

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

    const items = buildClientList(clients, (cases ?? []) as ClientCaseRecord[], purchaseByEmail);
    const filteredItems = status
      ? items.filter((item) => status === "no_case" ? !item.latest_case : item.latest_case?.status === status)
      : items;

    return json({ items: filteredItems });
  } catch (error) {
    return handleApiError(error);
  }
}
