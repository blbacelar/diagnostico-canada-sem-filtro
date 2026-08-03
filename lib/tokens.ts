import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

function secret() {
  const value = process.env.FORM_TOKEN_SECRET;
  if (!value || value.length < 32) throw new Error("FORM_TOKEN_SECRET precisa ter pelo menos 32 caracteres.");
  return value;
}

export function createFormToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashFormToken(token: string) {
  return createHmac("sha256", secret()).update(token, "utf8").digest("hex");
}

export function hashIp(ip: string) {
  return createHash("sha256").update(`${secret()}:${ip}`).digest("hex");
}

export function constantTimeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function formTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)diagnostic_form_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function tokenCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 14) {
  return `diagnostic_form_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
