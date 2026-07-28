import type { Env } from "../../types";
import type { AdminIdentity } from "../../lib/auth";
import { withDb } from "../../services/db";

type TokenExchangeResponse = { access_token: string };

export async function ensureManagedShop(env: Env, admin: AdminIdentity) {
  const existing = await withDb(env, (db) => db.query<{ id: string }>("select id from shops where domain=$1 and status='active'", [admin.shopDomain]));
  if (existing.rowCount) return existing.rows[0].id;

  const exchange = await fetch(`https://${admin.shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: admin.sessionToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    }),
  });
  if (!exchange.ok) {
    console.error("shop_token_exchange_failed", { shopDomain: admin.shopDomain, status: exchange.status });
    throw new Error("SHOP_TOKEN_EXCHANGE_FAILED");
  }

  const token = await exchange.json() as TokenExchangeResponse;
  const created = await withDb(env, async (db) => {
    const shop = await db.query<{ id: string }>(`insert into shops(shopify_shop_id,domain,access_token,status)
      values($1,$1,$2,'active')
      on conflict(domain) do update set access_token=excluded.access_token,status='active',updated_at=now()
      returning id`, [admin.shopDomain, token.access_token]);
    await db.query("insert into shop_settings(shop_id) values($1) on conflict do nothing", [shop.rows[0].id]);
    return shop.rows[0];
  });
  console.info("shop_token_exchange_completed", { shopDomain: admin.shopDomain });
  return created.id;
}
