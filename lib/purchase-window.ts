import { getAdminSupabase } from "./supabase";

export const DELIVERY_WAIT_DAYS = 7;

export const approvedPurchaseEvents = ["APPROVED", "PURCHASE_COMPLETE", "PURCHASE_APPROVED"] as const;

const purchaseEvents = new Set<string>(approvedPurchaseEvents);
const dayInMs = 24 * 60 * 60 * 1000;
const diagnosticProductKeywords = [
  "diagnostico",
  "simulador",
  "o canada e pra voce",
];
const nonDiagnosticProductKeywords = [
  "masterclass",
  "aula gratuita",
  "inscricao",
  "inscrição",
];

export type AllowedEmailEventRow = {
  email: string;
  last_event: string | null;
  created_at?: string | null;
  updated_at: string | null;
  last_event_at: string | null;
  external_reference?: string | null;
  purchase_date?: string | null;
  active: boolean | null;
  purchase_verified?: boolean;
};

export type PurchaseWindow = {
  purchaseDate: string | null;
  purchaseEvent: string | null;
  daysSincePurchase: number | null;
  daysRemaining: number | null;
  eligibleToSend: boolean;
  message: string;
};

export type PurchaseRecordRow = {
  client_id: string | null;
  transaction_code: string | null;
  product_name?: string | null;
  status_hotmart: string | null;
  purchase_date: string | null;
  created_at: string | null;
};

function emailKey(value: string) {
  return value.trim().toLowerCase();
}

function searchableText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function isApprovedPurchaseStatus(status: string | null | undefined) {
  return Boolean(status && purchaseEvents.has(status));
}

export function isDiagnosticProductPurchase(
  purchase: Pick<PurchaseRecordRow, "product_name" | "status_hotmart"> | null | undefined,
) {
  if (!purchase || !isApprovedPurchaseStatus(purchase.status_hotmart)) return false;
  const productName = searchableText(purchase.product_name);
  if (!productName) return false;
  if (nonDiagnosticProductKeywords.some((keyword) => productName.includes(searchableText(keyword)))) {
    return false;
  }
  return diagnosticProductKeywords.some((keyword) => productName.includes(searchableText(keyword)));
}

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function canonicalPurchaseDate(row: AllowedEmailEventRow) {
  return parseDate(row.purchase_date ?? null) ?? parseDate(row.created_at ?? null) ?? parseDate(row.last_event_at);
}

export function attachPurchaseRecord(
  row: AllowedEmailEventRow,
  purchase: Pick<PurchaseRecordRow, "product_name" | "purchase_date" | "status_hotmart"> | null | undefined,
): AllowedEmailEventRow {
  const purchaseVerified = isDiagnosticProductPurchase(purchase);
  return {
    ...row,
    last_event: purchaseVerified ? (purchase?.status_hotmart ?? row.last_event) : null,
    purchase_date: purchaseVerified ? (purchase?.purchase_date ?? row.purchase_date ?? null) : null,
    purchase_verified: purchaseVerified,
  };
}

export function buildPurchaseWindow(row: AllowedEmailEventRow | null, now = new Date()): PurchaseWindow {
  if (!row || row.purchase_verified === false || !row.last_event || !purchaseEvents.has(row.last_event)) {
    return {
      purchaseDate: null,
      purchaseEvent: row?.last_event ?? null,
      daysSincePurchase: null,
      daysRemaining: null,
      eligibleToSend: false,
      message: "A entrega só é liberada após compra aprovada.",
    };
  }

  const purchaseDate = canonicalPurchaseDate(row);
  if (!purchaseDate) {
    return {
      purchaseDate: null,
      purchaseEvent: row.last_event,
      daysSincePurchase: null,
      daysRemaining: null,
      eligibleToSend: false,
      message: "Data da compra indisponível para este cliente.",
    };
  }

  const elapsed = Math.max(0, now.getTime() - purchaseDate.getTime());
  const daysSincePurchase = Math.floor(elapsed / dayInMs);
  const daysRemaining = Math.max(0, DELIVERY_WAIT_DAYS + 1 - daysSincePurchase);
  const eligibleToSend = daysSincePurchase > DELIVERY_WAIT_DAYS;

  return {
    purchaseDate: purchaseDate.toISOString(),
    purchaseEvent: row.last_event,
    daysSincePurchase,
    daysRemaining,
    eligibleToSend,
    message: eligibleToSend
      ? "Envio liberado para este cliente."
      : `Envio liberado em ${daysRemaining} dia(s), após mais de ${DELIVERY_WAIT_DAYS} dias da compra.`,
  };
}

export function mapPurchaseWindowsByEmail(rows: AllowedEmailEventRow[], now = new Date()) {
  const map = new Map<string, PurchaseWindow>();
  const latestAtByEmail = new Map<string, number>();

  for (const row of rows) {
    const key = emailKey(row.email);
    const latestEventAt = parseDate(row.last_event_at)?.getTime() ?? 0;
    const latestEventAtForEmail = latestAtByEmail.get(key) ?? -1;
    if (latestEventAt < latestEventAtForEmail) continue;

    latestAtByEmail.set(key, latestEventAt);
    map.set(key, buildPurchaseWindow(row, now));
  }

  return map;
}

function isMissingPurchaseRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST205" || /purchases|schema cache|column/i.test(error.message ?? "");
}

export async function hasPurchasedAccessForEmail(
  admin: ReturnType<typeof getAdminSupabase>,
  email: string,
) {
  const normalized = emailKey(email);
  const { data: allowedRows, error: allowedError } = await admin
    .from("allowed_emails")
    .select("id,last_event,external_reference")
    .eq("email", normalized)
    .eq("active", true)
    .order("last_event_at", { ascending: false })
    .limit(10);

  if (allowedError) throw allowedError;

  const transactionCodes = [...new Set((allowedRows ?? [])
    .map((row) => row.external_reference)
    .filter((value): value is string => Boolean(value)))];

  if (transactionCodes.length > 0) {
    const { data: purchasesByTransaction, error: transactionError } = await admin
      .from("purchases")
      .select("id,product_name,status_hotmart,purchase_date,created_at")
      .in("transaction_code", transactionCodes)
      .in("status_hotmart", [...approvedPurchaseEvents])
      .limit(20);

    if (transactionError && !isMissingPurchaseRelationError(transactionError)) throw transactionError;
    if ((purchasesByTransaction ?? []).some(isDiagnosticProductPurchase)) return true;
  }

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id")
    .eq("email", normalized)
    .limit(1)
    .maybeSingle();

  if (clientError) throw clientError;
  if (!client?.id) return false;

  const { data: purchases, error } = await admin
    .from("purchases")
    .select("id,product_name,status_hotmart,purchase_date,created_at")
    .eq("client_id", client.id)
    .in("status_hotmart", [...approvedPurchaseEvents])
    .limit(20);

  if (error && !isMissingPurchaseRelationError(error)) throw error;
  return (purchases ?? []).some(isDiagnosticProductPurchase);
}

async function fetchPurchaseRecordForAllowedEmail(
  admin: ReturnType<typeof getAdminSupabase>,
  row: AllowedEmailEventRow,
) {
  if (row.external_reference) {
    const { data, error } = await admin
      .from("purchases")
      .select("client_id,transaction_code,product_name,status_hotmart,purchase_date,created_at")
      .eq("transaction_code", row.external_reference)
      .in("status_hotmart", [...approvedPurchaseEvents])
      .order("purchase_date", { ascending: true })
      .limit(20);

    if (error && !isMissingPurchaseRelationError(error)) throw error;
    const purchase = ((data ?? []) as PurchaseRecordRow[]).find(isDiagnosticProductPurchase);
    if (purchase) return purchase;
  }

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id")
    .eq("email", emailKey(row.email))
    .limit(1)
    .maybeSingle();

  if (clientError) throw clientError;
  if (!client?.id) return null;

  const { data, error } = await admin
    .from("purchases")
    .select("client_id,transaction_code,product_name,status_hotmart,purchase_date,created_at")
    .eq("client_id", client.id)
    .in("status_hotmart", [...approvedPurchaseEvents])
    .order("purchase_date", { ascending: true })
    .limit(20);

  if (error && !isMissingPurchaseRelationError(error)) throw error;
  return (((data ?? []) as PurchaseRecordRow[]).find(isDiagnosticProductPurchase) ?? null) as PurchaseRecordRow | null;
}

export async function getPurchaseWindowForEmail(
  admin: ReturnType<typeof getAdminSupabase>,
  email: string,
  now = new Date(),
) {
  const normalized = emailKey(email);
  const { data, error } = await admin
    .from("allowed_emails")
    .select("email,last_event,created_at,updated_at,last_event_at,external_reference,active")
    .eq("email", normalized)
    .eq("active", true)
    .order("last_event_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const allowedEmailRow = (data ?? null) as AllowedEmailEventRow | null;
  const purchaseRecord = allowedEmailRow ? await fetchPurchaseRecordForAllowedEmail(admin, allowedEmailRow) : null;

  return buildPurchaseWindow(
    allowedEmailRow ? attachPurchaseRecord(allowedEmailRow, purchaseRecord) : null,
    now,
  );
}
