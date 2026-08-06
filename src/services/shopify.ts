import { hmacHex, safeEqual } from "../lib/crypto";
import type { Env } from "../types";

export async function validWebhook(request: Request, body: string, secret: string) {
  if (!secret?.trim()) return false;
  const given = request.headers.get("x-shopify-hmac-sha256") ?? "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return safeEqual(given, btoa(String.fromCharCode(...new Uint8Array(signature))));
}
export async function verifyTurnstile(token: string, remoteIp: string | null, env: Env) {
  if (!token) return false;
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: remoteIp }) });
  const result = await response.json() as { success: boolean; "error-codes"?: string[] };
  if (!result.success) console.warn("turnstile_verification_failed", { errorCodes: result["error-codes"] ?? [] });
  return result.success;
}
export async function buildOAuthRedirect(shop: string, env: Env) {
  const state = await hmacHex(env.TOKEN_SECRET, `${shop}:${Date.now()}`);
  const params = new URLSearchParams({ client_id: env.SHOPIFY_API_KEY, scope: "read_products,read_orders,read_files,write_files", redirect_uri: `${env.APP_URL}/auth/callback`, state });
  return { state, url: `https://${shop}/admin/oauth/authorize?${params}` };
}
