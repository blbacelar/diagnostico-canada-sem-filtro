"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabase } from "../lib/supabase";

const lockHeartbeatIntervalMs = 60_000;

async function getAccessToken() {
  const { data } = await getBrowserSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}

function sendLockRequest(caseId: string, method: "POST" | "DELETE", accessToken: string) {
  return fetch(`/api/dashboard/cases/${caseId}/lock`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    keepalive: method === "DELETE",
  }).catch(() => {
    // Best-effort lock lifecycle: stale locks are protected by server-side expiration.
  });
}

export function useCaseLockLifecycle(caseId: string, enabled = true) {
  const accessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    const withToken = async (callback: (token: string) => void | Promise<void>) => {
      let token = accessTokenRef.current;
      if (!token) {
        token = await getAccessToken();
        if (active) accessTokenRef.current = token;
      }
      if (active && token) await callback(token);
    };

    const refresh = () => {
      void withToken(async (token) => {
        await sendLockRequest(caseId, "POST", token);
      });
    };

    const release = () => {
      const token = accessTokenRef.current;
      if (token) void sendLockRequest(caseId, "DELETE", token);
    };

    void withToken(() => undefined);
    const interval = window.setInterval(refresh, lockHeartbeatIntervalMs);
    window.addEventListener("pagehide", release);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [caseId, enabled]);
}
