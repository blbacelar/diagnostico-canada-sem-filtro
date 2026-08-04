import { getBrowserSupabase } from "./supabase";

export async function authorizedFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const { data } = await getBrowserSupabase().auth.getSession();
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    signal,
  });
  if (!response.ok) throw new Error("dashboard_request_failed");
  return await response.json() as T;
}
