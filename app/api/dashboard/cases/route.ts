/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase infers nested relation payloads at runtime. */
import { handleApiError, json, requireConsultant } from "../../../../lib/api";
import { decorateCaseLocks } from "../../../../lib/case-lock";
import { getCentralClientsByIds, searchCentralClients } from "../../../../lib/central-client";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

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
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const requestedPageSize = parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(MAX_PAGE_SIZE, requestedPageSize);
    const offset = (page - 1) * pageSize;

    let clientIds: string[] = [];
    if (search) {
      const clients = await searchCentralClients(admin, search, 50);
      clientIds = clients.map((item) => item.id);
    }

    const countQuery = applyFilters(
      admin
        .from("diagnostic_cases")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null),
      search,
      status,
      clientIds,
    );
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    const dataQuery = applyFilters(
      admin
        .from("diagnostic_cases")
        .select("id,case_number,status,objective,submitted_at,updated_at,assigned_consultant_id,client_id,diagnostic_ai_assessments(version,structured_result,status)")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .range(offset, offset + pageSize - 1),
      search,
      status,
      clientIds,
    );
    const { data, error } = await dataQuery;
    if (error) throw error;

    const clientsById = await getCentralClientsByIds(admin, (data ?? []).map((item: any) => item.client_id));
    const decorated = await decorateCaseLocks(admin, (data ?? []).map((item: any) => ({
      ...item,
      diagnostic_clients: clientsById.has(item.client_id)
        ? { full_name: clientsById.get(item.client_id)?.name ?? "", email_display: clientsById.get(item.client_id)?.email ?? "" }
        : null,
    })), user.id);
    const items = decorated.map((item: any) => ({
      ...item,
      diagnostic_ai_assessments: [...(item.diagnostic_ai_assessments ?? [])]
        .sort((left: any, right: any) => right.version - left.version)
        .slice(0, 1),
    }));

    const total = count ?? 0;
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
