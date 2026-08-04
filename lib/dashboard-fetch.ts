import { getBrowserSupabase } from "./supabase";

export class DashboardRequestError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

export async function authorizedFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  return authorizedRequest<T>(path, { method: "GET" }, signal);
}

export async function authorizedRequest<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  const { data } = await getBrowserSupabase().auth.getSession();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    signal,
  });
  const payload = await response.json() as T & { error?: string; code?: string };
  if (!response.ok) throw new DashboardRequestError(payload.error ?? "Não foi possível concluir esta operação.", payload.code);
  return payload;
}
