import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const publicSupabaseUrl =
  process.env.VITE_SUPABASE_URL ?? "https://jtkebfgfmugbqglwaatn.supabase.co";

export const publicSupabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0a2ViZmdmbXVnYnFnbHdhYXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODk2NDMsImV4cCI6MjA5NDM2NTY0M30.vFgcLn_jbh6MSQxWjym5R-XbKrVbVgjL5uhSnRj__f0";

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
