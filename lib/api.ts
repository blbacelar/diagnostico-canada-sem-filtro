import { ZodError, type ZodType } from "zod";
import { getAdminSupabase, getSupabaseForAccessToken } from "./supabase";
import { formTokenFromRequest, hashFormToken, hashIp } from "./tokens";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_ERROR",
  ) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...init.headers },
  });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return json({ error: "Confira os campos informados.", code: "VALIDATION_ERROR", details: error.flatten().fieldErrors }, { status: 422 });
  }
  if (error instanceof ApiError) return json({ error: error.message, code: error.code }, { status: error.status });
  console.error("diagnostic_api_error", error instanceof Error ? { name: error.name, message: error.message } : { type: typeof error });
  return json({ error: "Não foi possível concluir esta operação agora.", code: "INTERNAL_ERROR" }, { status: 500 });
}

export function hasDatabaseErrorCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function parseJson<T>(request: Request, schema: ZodType<T>, maxBytes = 120_000) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) throw new ApiError(413, "O conteúdo enviado é maior que o permitido.", "PAYLOAD_TOO_LARGE");
  const text = await request.text();
  if (text.length > maxBytes) throw new ApiError(413, "O conteúdo enviado é maior que o permitido.", "PAYLOAD_TOO_LARGE");
  return schema.parse(JSON.parse(text || "{}"));
}

export function requestIp(request: Request) {
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function enforceRateLimit(request: Request, action: string, limit: number, windowMinutes: number) {
  const admin = getAdminSupabase();
  const identifierHash = hashIp(`${action}:${requestIp(request)}`);
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowMinutes * 60_000)) * windowMinutes * 60_000).toISOString();
  const { data: existing, error: readError } = await admin
    .from("diagnostic_rate_limits")
    .select("id, request_count")
    .eq("identifier_hash", identifierHash)
    .eq("action", action)
    .eq("window_started_at", windowStart)
    .maybeSingle();
  if (readError) throw readError;
  if (existing && existing.request_count >= limit) throw new ApiError(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.", "RATE_LIMITED");
  if (existing) {
    const { error } = await admin.from("diagnostic_rate_limits").update({ request_count: existing.request_count + 1 }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("diagnostic_rate_limits").insert({ identifier_hash: identifierHash, action, window_started_at: windowStart, request_count: 1 });
    if (error && error.code !== "23505") throw error;
  }
}

export async function requireFormCase(request: Request) {
  const token = formTokenFromRequest(request);
  if (!token || token.length < 32) throw new ApiError(401, "O link é inválido, expirou ou foi revogado.", "INVALID_FORM_TOKEN");
  const admin = getAdminSupabase();
  const tokenHash = hashFormToken(token);
  const { data, error } = await admin
    .from("diagnostic_access_tokens")
    .select("id, case_id, expires_at, revoked_at, diagnostic_cases!inner(id, case_number, status, client_id, submitted_at)")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at || new Date(data.expires_at) <= new Date()) throw new ApiError(401, "O link é inválido, expirou ou foi revogado.", "INVALID_FORM_TOKEN");
  await admin.from("diagnostic_access_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { admin, token, tokenRow: data, caseRow: Array.isArray(data.diagnostic_cases) ? data.diagnostic_cases[0] : data.diagnostic_cases };
}

export async function requireConsultant(request: Request, role?: "admin") {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ApiError(401, "Faça login para continuar.", "AUTH_REQUIRED");
  const accessToken = authorization.slice(7).trim();
  const userClient = getSupabaseForAccessToken(accessToken);
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) throw new ApiError(401, "Sua sessão expirou. Entre novamente.", "AUTH_REQUIRED");
  const { data: consultant, error } = await userClient
    .from("diagnostic_consultants")
    .select("user_id, role, active, display_name")
    .eq("user_id", authData.user.id)
    .eq("active", true)
    .maybeSingle();
  if (error || !consultant) throw new ApiError(403, "Esta conta não possui acesso ao dashboard.", "ACCESS_DENIED");
  if (role === "admin" && consultant.role !== "admin") throw new ApiError(403, "Esta ação exige uma conta administradora.", "ADMIN_REQUIRED");
  return { user: authData.user, consultant, userClient, admin: getAdminSupabase(), accessToken };
}

export function getIdempotencyKey(request: Request, bodyKey?: string) {
  return request.headers.get("idempotency-key") ?? bodyKey ?? null;
}

export async function writeAudit(
  admin: ReturnType<typeof getAdminSupabase>,
  entry: { caseId?: string | null; actorUserId?: string | null; actorType: "client" | "consultant" | "system"; action: string; metadata?: Record<string, unknown> },
) {
  const { error } = await admin.from("diagnostic_audit_logs").insert({
    case_id: entry.caseId ?? null,
    actor_user_id: entry.actorUserId ?? null,
    actor_type: entry.actorType,
    action: entry.action,
    metadata: entry.metadata ?? {},
  });
  if (error) throw error;
}
