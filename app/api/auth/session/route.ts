import { ApiError, handleApiError, json } from "../../../../lib/api";
import { getSupabaseForAccessToken } from "../../../../lib/supabase";

const DASHBOARD_COOKIE = "dashboard_access_token";
const MAX_AGE_SECONDS = 60 * 60;

function sessionCookie(token: string) {
  return `${DASHBOARD_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

function clearSessionCookie() {
  return `${DASHBOARD_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) throw new ApiError(401, "Sessão inválida.", "AUTH_REQUIRED");
    const accessToken = authorization.slice(7).trim();
    if (!accessToken) throw new ApiError(401, "Sessão inválida.", "AUTH_REQUIRED");

    const userClient = getSupabaseForAccessToken(accessToken);
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) throw new ApiError(401, "Sessão inválida.", "AUTH_REQUIRED");

    const response = json({ ok: true });
    response.headers.append("Set-Cookie", sessionCookie(accessToken));
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  const response = json({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}
