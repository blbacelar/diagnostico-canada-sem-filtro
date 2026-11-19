import { getSupabaseForAccessToken } from './supabase';

const cookieName = 'csf_diagnostic_portal_access';

export function portalAccessCookie(token: string) {
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3500`;
}

export function portalTokenFromCookie(request: Request) {
  const match = (request.headers.get('cookie') ?? '').match(/(?:^|;\s*)csf_diagnostic_portal_access=([^;]+)/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

// A identidade e o direito são verificados pelo mesmo Supabase usado no portal.
export async function verifiedPortalStudent(token: string) {
  if (!token || token.length > 8192) return null;
  const client = getSupabaseForAccessToken(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.email) return null;
  const access = await client.rpc('csf_portal_mentoria_autorizada');
  if (access.error || access.data !== true) return null;
  return { id: data.user.id, email: data.user.email.trim().toLowerCase() };
}
