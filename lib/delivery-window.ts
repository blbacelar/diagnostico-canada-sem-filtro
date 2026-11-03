import type { PurchaseWindow } from "./purchase-window";
import { simulatorSalesConfig } from "./simulator-sales";

export const DELIVERY_BUSINESS_DAYS = simulatorSalesConfig.deliveryReleaseBusinessDays;

export type DeliveryWindow = {
  submittedAt: string | null;
  deliveryReleaseAt: string | null;
  eligibleToSend: boolean;
  /** A consultant may waive only the delivery wait, never purchase validation. */
  canOverrideWaitPeriod: boolean;
  message: string;
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isBusinessDay(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Adds weekdays (Monday through Friday) to the timestamp at which the client
 * submitted their responses. Public holidays are intentionally not inferred.
 */
export function getDeliveryReleaseAt(submittedAt: string | null | undefined) {
  const submitted = parseDate(submittedAt);
  if (!submitted) return null;

  const deadline = new Date(submitted);
  let remainingBusinessDays = DELIVERY_BUSINESS_DAYS;
  while (remainingBusinessDays > 0) {
    deadline.setUTCDate(deadline.getUTCDate() + 1);
    if (isBusinessDay(deadline)) remainingBusinessDays -= 1;
  }
  return deadline.toISOString();
}

export function formatDeliveryDeadline(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function buildDeliveryWindow(
  purchaseWindow: Pick<PurchaseWindow, "purchaseDate" | "purchaseEvent"> | null | undefined,
  submittedAt: string | null | undefined,
  now = new Date(),
): DeliveryWindow {
  if (!purchaseWindow?.purchaseDate || !purchaseWindow.purchaseEvent) {
    return {
      submittedAt: null,
      deliveryReleaseAt: null,
      eligibleToSend: false,
      canOverrideWaitPeriod: false,
      message: "A entrega só é liberada após compra aprovada.",
    };
  }

  const submitted = parseDate(submittedAt);
  if (!submitted) {
    return {
      submittedAt: null,
      deliveryReleaseAt: null,
      eligibleToSend: false,
      canOverrideWaitPeriod: false,
      message: "A entrega será liberada após o envio das respostas pelo cliente.",
    };
  }

  const deliveryReleaseAt = getDeliveryReleaseAt(submitted.toISOString());
  if (!deliveryReleaseAt) {
    return {
      submittedAt: submitted.toISOString(),
      deliveryReleaseAt: null,
      eligibleToSend: false,
      canOverrideWaitPeriod: false,
      message: "Não foi possível calcular a data de liberação da entrega.",
    };
  }

  // The cron runs once a day. Delivery is therefore released on the calendar
  // date shown to the client, rather than at the exact submission clock time.
  const eligibleToSend = startOfUtcDay(now) >= startOfUtcDay(new Date(deliveryReleaseAt));
  const formattedDeadline = formatDeliveryDeadline(deliveryReleaseAt);
  return {
    submittedAt: submitted.toISOString(),
    deliveryReleaseAt,
    eligibleToSend,
    canOverrideWaitPeriod: !eligibleToSend,
    message: eligibleToSend
      ? "Envio liberado para este cliente."
      : `Envio liberado a partir de ${formattedDeadline}, até ${DELIVERY_BUSINESS_DAYS} dias úteis após o envio das respostas.`,
  };
}
