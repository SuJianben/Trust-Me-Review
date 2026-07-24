import { hmacHex, safeEqual } from "./crypto";
import type { Env } from "../types";

function base64UrlDecode(input: string) { return new TextDecoder().decode(Uint8Array.from(atob(input.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))); }
export async function verifyAdminSession(request: Request, env: Env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const [encodedHeader, encodedPayload, signature] = token.split("."); if (!encodedHeader || !encodedPayload || !signature) return null;
  const expected = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SHOPIFY_API_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", expected, new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  if (!safeEqual(encoded, signature)) return null;
  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as { dest?: string; sub?: string; exp?: number; aud?: string | string[] };
  if (!payload.dest || !payload.exp || payload.exp < Date.now() / 1000 || !(Array.isArray(payload.aud) ? payload.aud : [payload.aud]).includes(env.SHOPIFY_API_KEY)) return null;
  return { shopDomain: new URL(payload.dest).hostname, userId: payload.sub ?? "shopify-admin" };
}
export async function createOAuthState(shop: string, env: Env) { const timestamp = Date.now().toString(); return `${timestamp}.${await hmacHex(env.TOKEN_SECRET, `${shop}:${timestamp}`)}`; }
export async function validOAuthState(shop: string, state: string, env: Env) { const [timestamp, signature] = state.split("."); if (!timestamp || !signature || Date.now() - Number(timestamp) > 10 * 60_000) return false; return safeEqual(await hmacHex(env.TOKEN_SECRET, `${shop}:${timestamp}`), signature); }
