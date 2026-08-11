/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase infers nested relation payloads at runtime. */
import { handleApiError, json, requireConsultant } from "../../../../lib/api";
import { decorateCaseLocks } from "../../../../lib/case-lock";

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
      const { data: clients, error: clientsError } = await admin
        .from("clients")
        .select("id")
        .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(50);
      if (clientsError) throw clientsError;
      clientIds = (clients ?? []).map((item) => item.id);
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
        .select("id,case_number,status,objective,submitted_at,updated_at,assigned_consultant_id,clients(name,email),diagnostic_ai_assessments(version,structured_result,status)")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .range(offset, offset + pageSize - 1),
      search,
      status,
      clientIds,
    );
    const { data, error } = await dataQuery;
    if (error) throw error;

    const decorated = await decorateCaseLocks(admin, (data ?? []).map((item: any) => ({
      ...item,
      diagnostic_clients: item.clients ? { full_name: item.clients.name, email_display: item.clients.email } : null,
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
