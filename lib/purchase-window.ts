import { getAdminSupabase } from "./supabase";

export const DELIVERY_WAIT_DAYS = 7;

const purchaseEvents = new Set(["PURCHASE_COMPLETE", "PURCHASE_APPROVED"]);
const dayInMs = 24 * 60 * 60 * 1000;

export type AllowedEmailEventRow = {
  email: string;
  last_event: string | null;
  updated_at: string | null;
  last_event_at: string | null;
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

function emailKey(value: string) {
  return value.trim().toLowerCase();
}

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
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

  const purchaseDate = parseDate(row.last_event_at);
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
    purchaseDate: row.last_event_at,
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
    const lasteventAt = parseDate(row.last_event_at)?.getTime() ?? 0;
    const latestAt = latestAtByEmail.get(key) ?? -1;
    if (lasteventAt < latestAt) continue;

    latestAtByEmail.set(key, lasteventAt);
    map.set(key, buildPurchaseWindow(row, now));
  }

  return map;
}

export async function getPurchaseWindowForEmail(
  admin: ReturnType<typeof getAdminSupabase>,
  email: string,
  now = new Date(),
) {
  const normalized = emailKey(email);
  const { data, error } = await admin
    .from("allowed_emails")
    .select("email,last_event,last_event_at,active")
    .ilike("email", normalized)
    .eq("active", true)
    .order("last_event_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return buildPurchaseWindow((data ?? null) as AllowedEmailEventRow | null, now);
}