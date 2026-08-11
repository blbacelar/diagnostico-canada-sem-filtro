import { getAdminSupabase } from "./supabase";

export const DELIVERY_WAIT_DAYS = 7;

const purchaseEvents = new Set(["PURCHASE_COMPLETE", "PURCHASE_APPROVED"]);
const dayInMs = 24 * 60 * 60 * 1000;

export type AllowedEmailEventRow = {
  email: string;
  last_event: string | null;
  created_at?: string | null;
  updated_at: string | null;
  last_event_at: string | null;
  external_reference?: string | null;
  purchase_date?: string | null;
  active: boolean | null;
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
  status_hotmart: string | null;
  purchase_date: string | null;
  created_at: string | null;
};

function emailKey(value: string) {
  return value.trim().toLowerCase();
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
  purchase: Pick<PurchaseRecordRow, "purchase_date"> | null | undefined,
): AllowedEmailEventRow {
  return {
    ...row,
    purchase_date: purchase?.purchase_date ?? row.purchase_date ?? null,
  };
}

export function buildPurchaseWindow(row: AllowedEmailEventRow | null, now = new Date()): PurchaseWindow {
  if (!row || !row.last_event || !purchaseEvents.has(row.last_event)) {
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

async function fetchPurchaseRecordForAllowedEmail(
  admin: ReturnType<typeof getAdminSupabase>,
  row: AllowedEmailEventRow,
) {
  if (row.external_reference) {
    const { data, error } = await admin
      .from("purchases")
      .select("client_id,transaction_code,status_hotmart,purchase_date,created_at")
      .eq("transaction_code", row.external_reference)
      .order("purchase_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error && !isMissingPurchaseRelationError(error)) throw error;
    if (data) return data as PurchaseRecordRow;
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
    .select("client_id,transaction_code,status_hotmart,purchase_date,created_at")
    .eq("client_id", client.id)
    .order("purchase_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error && !isMissingPurchaseRelationError(error)) throw error;
  return (data ?? null) as PurchaseRecordRow | null;
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
