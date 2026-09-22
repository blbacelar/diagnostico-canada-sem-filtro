import { getAdminSupabase } from "./supabase";
import { simulatorSalesConfig } from "./simulator-sales";

export const DELIVERY_WAIT_DAYS = simulatorSalesConfig.deliveryReleaseDays;

export const approvedPurchaseEvents = ["APPROVED", "COMPLETE", "PURCHASE_COMPLETE", "PURCHASE_COMPLETED", "PURCHASE_APPROVED"] as const;

const purchaseEvents = new Set<string>(approvedPurchaseEvents);
const annualBundleProductId = 8575181;
const dayInMs = 24 * 60 * 60 * 1000;
const diagnosticProductNames = [
  "7 aulas + e-book + app + diagnostico - o canada e pra voce?",
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
  source?: string | null;
  notes?: string | null;
  purchase_date?: string | null;
  access_product_id?: number | null;
  access_expires_at?: string | null;
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
  product_id?: number | null;
  access_expires_at?: string | null;
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
  purchase: Pick<PurchaseRecordRow, "product_name" | "product_id" | "status_hotmart" | "access_expires_at"> | null | undefined,
  now = new Date(),
) {
  if (!purchase || !isApprovedPurchaseStatus(purchase.status_hotmart)) return false;
  if (purchase.product_id === annualBundleProductId) {
    const expiresAt = parseDate(purchase.access_expires_at ?? null);
    return Boolean(expiresAt && expiresAt > now);
  }
  const productName = searchableText(purchase.product_name);
  if (!productName) return false;
  if (nonDiagnosticProductKeywords.some((keyword) => productName.includes(searchableText(keyword)))) {
    return false;
  }
  return diagnosticProductNames.some((allowedProduct) => productName === searchableText(allowedProduct));
}

function hasNonDiagnosticProductSignal(value: string | null | undefined) {
  const text = searchableText(value);
  return Boolean(text && nonDiagnosticProductKeywords.some((keyword) => text.includes(searchableText(keyword))));
}

export function isAllowedEmailAccessActive(
  row: Pick<AllowedEmailEventRow, "active" | "last_event" | "source" | "notes" | "access_product_id" | "access_expires_at"> | null | undefined,
  now = new Date(),
) {
  if (!row?.active) return false;
  if (row.access_product_id === annualBundleProductId && !row.access_expires_at) return false;
  if (row.access_expires_at && (parseDate(row.access_expires_at)?.getTime() ?? 0) <= now.getTime()) return false;
  if (hasNonDiagnosticProductSignal(row.source) || hasNonDiagnosticProductSignal(row.notes)) return false;
  if (!row.last_event) return true;
  return isApprovedPurchaseStatus(row.last_event);
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
  purchase: Pick<PurchaseRecordRow, "product_name" | "product_id" | "purchase_date" | "status_hotmart" | "access_expires_at"> | null | undefined,
  now = new Date(),
): AllowedEmailEventRow {
  // Some historical Hotmart events were migrated before the `purchases`
  // relation existed. In those cases, `allowed_emails` is the authoritative
  // record of the approved purchase. Keep accepting that record, while still
  // rejecting access explicitly marked as a masterclass or a refund.
  const purchaseVerified = purchase
    ? isDiagnosticProductPurchase(purchase, now)
    : isAllowedEmailAccessActive(row, now);
  return {
    ...row,
    last_event: purchaseVerified ? (purchase?.status_hotmart ?? row.last_event) : null,
    purchase_date: purchaseVerified ? (purchase?.purchase_date ?? row.purchase_date ?? null) : null,
    access_product_id: purchaseVerified && purchase ? (purchase.product_id ?? null) : row.access_product_id,
    access_expires_at: purchaseVerified && purchase ? (purchase.access_expires_at ?? null) : row.access_expires_at,
    purchase_verified: purchaseVerified,
  };
}

export function buildPurchaseWindow(row: AllowedEmailEventRow | null, now = new Date()): PurchaseWindow {
  if (!row || row.purchase_verified === false || !isAllowedEmailAccessActive(row, now) || !row.last_event || !purchaseEvents.has(row.last_event)) {
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
  return error.code === "PGRST205" || /purchases|clients|schema cache|column/i.test(error.message ?? "");
}

export async function hasPurchasedAccessForEmail(
  admin: ReturnType<typeof getAdminSupabase>,
  email: string,
) {
  const normalized = emailKey(email);
  const { data: allowedRows, error: allowedError } = await admin
    .from("allowed_emails")
    .select("id,last_event,external_reference,source,notes,active,access_product_id,access_expires_at")
    .eq("email", normalized)
    .eq("active", true)
    .order("last_event_at", { ascending: false })
    .limit(10);

  if (allowedError) throw allowedError;

  const transactionCodes = [...new Set((allowedRows ?? [])
    .map((row) => row.external_reference)
    .filter((value): value is string => Boolean(value)))];
  let hasOnlyReferencedPurchaseRows = false;

  if (transactionCodes.length > 0) {
    const { data: purchasesByTransaction, error: transactionError } = await admin
      .from("purchases")
      .select("id,transaction_code,product_name,product_id,status_hotmart,purchase_date,created_at,access_expires_at")
      .in("transaction_code", transactionCodes)
      .limit(20);

    if (transactionError && !isMissingPurchaseRelationError(transactionError)) throw transactionError;
    if ((purchasesByTransaction ?? []).some((purchase) => isDiagnosticProductPurchase(purchase))) return true;
    const foundCodes = new Set((purchasesByTransaction ?? [])
      .map((purchase) => purchase.transaction_code)
      .filter((value): value is string => Boolean(value)));
    hasOnlyReferencedPurchaseRows = foundCodes.size > 0 && transactionCodes.every((code) => foundCodes.has(code));
  }

  if (!hasOnlyReferencedPurchaseRows && (allowedRows ?? []).some((row) => isAllowedEmailAccessActive(row))) return true;

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id")
    .eq("email", normalized)
    .limit(1)
    .maybeSingle();

  if (clientError && isMissingPurchaseRelationError(clientError)) return false;
  if (clientError) throw clientError;
  if (!client?.id) return false;

  const { data: purchases, error } = await admin
    .from("purchases")
    .select("id,product_name,product_id,status_hotmart,purchase_date,created_at,access_expires_at")
    .eq("client_id", client.id)
    .in("status_hotmart", [...approvedPurchaseEvents])
    .limit(20);

  if (error && !isMissingPurchaseRelationError(error)) throw error;
  return (purchases ?? []).some((purchase) => isDiagnosticProductPurchase(purchase));
}

async function fetchPurchaseRecordForAllowedEmail(
  admin: ReturnType<typeof getAdminSupabase>,
  row: AllowedEmailEventRow,
) {
  let referencedPurchase: PurchaseRecordRow | null = null;
  if (row.external_reference) {
    const { data, error } = await admin
      .from("purchases")
      .select("client_id,transaction_code,product_name,product_id,status_hotmart,purchase_date,created_at,access_expires_at")
      .eq("transaction_code", row.external_reference)
      .order("purchase_date", { ascending: true })
      .limit(20);

    if (error && !isMissingPurchaseRelationError(error)) throw error;
    const purchase = ((data ?? []) as PurchaseRecordRow[]).find((item) => isDiagnosticProductPurchase(item));
    if (purchase) return purchase;
    referencedPurchase = ((data ?? []) as PurchaseRecordRow[])[0] ?? null;
  }

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id")
    .eq("email", emailKey(row.email))
    .limit(1)
    .maybeSingle();

  if (clientError && isMissingPurchaseRelationError(clientError)) return referencedPurchase;
  if (clientError) throw clientError;
  if (!client?.id) return referencedPurchase;

  const { data, error } = await admin
    .from("purchases")
    .select("client_id,transaction_code,product_name,product_id,status_hotmart,purchase_date,created_at,access_expires_at")
    .eq("client_id", client.id)
    .in("status_hotmart", [...approvedPurchaseEvents])
    .order("purchase_date", { ascending: true })
    .limit(20);

  if (error && !isMissingPurchaseRelationError(error)) throw error;
  return ((data ?? []) as PurchaseRecordRow[]).find((item) => isDiagnosticProductPurchase(item)) ?? referencedPurchase;
}

export async function getPurchaseWindowForEmail(
  admin: ReturnType<typeof getAdminSupabase>,
  email: string,
  now = new Date(),
) {
  const normalized = emailKey(email);
  const { data, error } = await admin
    .from("allowed_emails")
    .select("email,last_event,created_at,updated_at,last_event_at,external_reference,source,notes,active,access_product_id,access_expires_at")
    .eq("email", normalized)
    .eq("active", true)
    .order("last_event_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const allowedEmailRow = (data ?? null) as AllowedEmailEventRow | null;
  const purchaseRecord = allowedEmailRow ? await fetchPurchaseRecordForAllowedEmail(admin, allowedEmailRow) : null;

  return buildPurchaseWindow(
    allowedEmailRow ? attachPurchaseRecord(allowedEmailRow, purchaseRecord, now) : null,
    now,
  );
}
