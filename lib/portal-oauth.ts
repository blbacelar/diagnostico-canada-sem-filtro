'use client';

const AUTH_ORIGIN = 'https://amkrasedammnrlzbciue.supabase.co';
const STORAGE_KEY = 'csf-diagnostic-oauth-attempt';
const MAX_AGE = 5 * 60 * 1000;
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

function configuration() {
  const clientId = process.env.NEXT_PUBLIC_PORTAL_DIAGNOSTIC_OAUTH_CLIENT_ID;
  if (!clientId || !/^[A-Za-z0-9_-]{10,128}$/.test(clientId)) throw new Error('Acesso pelo portal ainda não configurado.');
  return { clientId, redirect: `${window.location.origin}/portal-acesso` };
}

export async function beginPortalAuthorization() {
  const { clientId, redirect } = configuration();
  const verifier = random();
  const state = random();
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ verifier, state, createdAt: Date.now() }));
  const url = new URL('/auth/v1/oauth/authorize', AUTH_ORIGIN);
  for (const [key, value] of Object.entries({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'email', state, code_challenge: challenge, code_challenge_method: 'S256' })) url.searchParams.set(key, value);
  window.location.assign(url.toString());
}

export async function completePortalAuthorization(params: URLSearchParams): Promise<string> {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  const { clientId, redirect } = configuration();
  const state = params.get('state');
  const code = params.get('code');
  const issuer = params.getAll('iss');
  if (!saved || params.getAll('state').length !== 1 || params.getAll('code').length !== 1 || issuer.length > 1 || (issuer.length === 1 && issuer[0] !== `${AUTH_ORIGIN}/auth/v1`) || !state || !code || code.length > 2048) throw new Error('A solicitação expirou. Tente novamente.');
  let attempt: { verifier?: unknown; state?: unknown; createdAt?: unknown };
  try { attempt = JSON.parse(saved); } catch { throw new Error('A solicitação expirou. Tente novamente.'); }
  if (typeof attempt.verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(attempt.verifier) || attempt.state !== state || typeof attempt.createdAt !== 'number' || Date.now() < attempt.createdAt || Date.now() - attempt.createdAt > MAX_AGE) throw new Error('A solicitação expirou. Tente novamente.');
  const response = await fetch(`${AUTH_ORIGIN}/auth/v1/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirect, code, code_verifier: attempt.verifier }) });
  if (!response.ok) throw new Error('Não foi possível confirmar o acesso. Tente novamente.');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('access_token' in result) || typeof result.access_token !== 'string' || !result.access_token) throw new Error('Não foi possível confirmar o acesso. Tente novamente.');
  return result.access_token;
}
