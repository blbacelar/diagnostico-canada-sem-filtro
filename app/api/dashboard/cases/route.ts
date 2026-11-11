/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase infers nested relation payloads at runtime. */
import { handleApiError, json, requireConsultant } from "../../../../lib/api";
import { decorateCaseLocks } from "../../../../lib/case-lock";
import { getCentralClientsByIds, searchCentralClients } from "../../../../lib/central-client";
import { buildDeliveryWindow } from "../../../../lib/delivery-window";
import { getPurchaseWindowsForClients } from "../../../../lib/purchase-window";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
// Delivery dates are derived from the purchase and submission records, so the
// final ordering must happen after those records are joined to the cases.
const MAX_SORT_CANDIDATES = 2_000;
const dateFields = new Set(["purchase", "draft", "submission", "release"]);
const terminalCaseStatuses = new Set(["sent", "cancelled", "archived"]);

function sanitizeSearch(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s@._-]/gu, "")
    .trim()
    .slice(0, 120);
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDateFilter(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function getDateKey(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function matchesDateRange(value: string | null | undefined, from: string | null, to: string | null) {
  const dateKey = getDateKey(value);
  if (!dateKey) return false;
  return (!from || dateKey >= from) && (!to || dateKey <= to);
}

function getDeliveryPriority(item: { status: string; delivery_release_at?: string | null }) {
  if (terminalCaseStatuses.has(item.status)) return 3;

  const releaseDate = item.delivery_release_at ? new Date(item.delivery_release_at) : null;
  if (!releaseDate || Number.isNaN(releaseDate.getTime())) return 2;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfReleaseDate = new Date(
    releaseDate.getFullYear(),
    releaseDate.getMonth(),
    releaseDate.getDate(),
  ).getTime();

  // An overdue delivery needs attention before today's and future deliveries.
  if (startOfReleaseDate < startOfToday) return 0;
  if (startOfReleaseDate === startOfToday) return 1;
  return 2;
}

function sortByDeliveryPriority(items: any[]) {
  return [...items].sort((left, right) => {
    const priorityDifference = getDeliveryPriority(left) - getDeliveryPriority(right);
    if (priorityDifference !== 0) return priorityDifference;

    const leftReleaseAt = left.delivery_release_at ? new Date(left.delivery_release_at).getTime() : Number.POSITIVE_INFINITY;
    const rightReleaseAt = right.delivery_release_at ? new Date(right.delivery_release_at).getTime() : Number.POSITIVE_INFINITY;
    if (leftReleaseAt !== rightReleaseAt) return leftReleaseAt - rightReleaseAt;

    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

function applyFilters(query: any, search: string, status: string | null, clientIds: string[]) {
  if (status) query.eq("status", status);
  if (search) {
    query.or(`case_number.ilike.%${search}%${clientIds.length ? `,client_id.in.(${clientIds.join(",")})` : ""}`);
  }
  return query;
}

export async function GET(request: Request) {
  try {
    const { admin, user } = await requireConsultant(request);
    const url = new URL(request.url);
    const rawSearch = url.searchParams.get("search") ?? "";
    const search = sanitizeSearch(rawSearch);
    const status = url.searchParams.get("status")?.trim() ?? null;
    const requestedDateField = url.searchParams.get("dateField") ?? "purchase";
    const dateField = dateFields.has(requestedDateField) ? requestedDateField : "purchase";
    const dateFrom = parseDateFilter(url.searchParams.get("dateFrom"));
    const dateTo = parseDateFilter(url.searchParams.get("dateTo"));
    const hasDateFilter = Boolean(dateFrom || dateTo);
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const requestedPageSize = parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(MAX_PAGE_SIZE, requestedPageSize);
    const offset = (page - 1) * pageSize;

    let clientIds: string[] = [];
    if (search) {
      const clients = await searchCentralClients(admin, search, 50);
      clientIds = clients.map((item) => item.id);
    }

    const caseSelect = "id,case_number,status,objective,created_at,submitted_at,updated_at,assigned_consultant_id,client_id,diagnostic_ai_assessments(version,structured_result,status)";
    const dataQuery = applyFilters(
      admin
        .from("diagnostic_cases")
        .select(caseSelect)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .range(0, MAX_SORT_CANDIDATES - 1),
      search,
      status,
      clientIds,
    );
    const { data: allCandidates, error } = await dataQuery;
    if (error) throw error;
    const data = allCandidates ?? [];

    const clientsById = await getCentralClientsByIds(admin, data.map((item: any) => item.client_id));
    const purchaseWindowsByEmail = await getPurchaseWindowsForClients(admin, [...clientsById.values()]);
    const decorated = await decorateCaseLocks(admin, data.map((item: any) => {
      const client = clientsById.get(item.client_id);
      const purchaseWindow = client ? purchaseWindowsByEmail.get(client.email.toLowerCase()) : null;
      const deliveryWindow = buildDeliveryWindow(purchaseWindow, item.submitted_at);
      return {
      ...item,
      purchase_date: purchaseWindow?.purchaseDate ?? null,
      delivery_release_at: deliveryWindow.deliveryReleaseAt,
      diagnostic_clients: client
        ? { full_name: client.name, email_display: client.email }
        : null,
      };
    }), user.id);
    const filtered = hasDateFilter
      ? decorated.filter((item: any) => matchesDateRange(
          dateField === "purchase"
            ? item.purchase_date
            : dateField === "release"
              ? item.delivery_release_at
              : item.submitted_at,
          dateFrom,
          dateTo,
        ))
      : decorated;
    const sorted = sortByDeliveryPriority(filtered);
    const total = sorted.length;
    const visibleItems = sorted.slice(offset, offset + pageSize);
    const items = visibleItems.map((item: any) => ({
      ...item,
      diagnostic_ai_assessments: [...(item.diagnostic_ai_assessments ?? [])]
        .sort((left: any, right: any) => right.version - left.version)
        .slice(0, 1),
    }));

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
