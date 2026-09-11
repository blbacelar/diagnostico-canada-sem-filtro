import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const resolvedPublicSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL;

const resolvedPublicSupabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

if (!resolvedPublicSupabaseUrl || !resolvedPublicSupabaseAnonKey) {
  throw new Error("Variáveis públicas do Supabase não configuradas.");
}

export const publicSupabaseUrl = resolvedPublicSupabaseUrl;
export const publicSupabaseAnonKey = resolvedPublicSupabaseAnonKey;

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase() {
  if (!browserClient) {
    browserClient = createClient(publicSupabaseUrl, publicSupabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return browserClient;
}

export function getAdminSupabase() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(publicSupabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function getSupabaseForAccessToken(accessToken: string) {
  return createClient(publicSupabaseUrl, publicSupabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
