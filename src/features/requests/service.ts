import type pg from "pg";
import { randomToken, seal, sha256, unseal } from "../../lib/crypto";

export async function createRequest(client: pg.Client, args: { shopId: string; productId: string; orderId: string; variantId?: string; email: string; scheduledAt: Date; tokenSecret: string }) {
  const token = await randomToken(); const tokenHash = await sha256(token); const emailHash = await sha256(args.email.toLowerCase());
  const result = await client.query<{ id: string }>(`insert into review_requests(shop_id,product_id,shopify_order_id,shopify_variant_id,customer_email_hash,token_hash,token_ciphertext,scheduled_at)
    values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(shop_id,shopify_order_id,product_id) do nothing returning id`, [args.shopId,args.productId,args.orderId,args.variantId ?? null,emailHash,tokenHash,await seal(token,args.tokenSecret),args.scheduledAt]);
  return result.rowCount ? { id: result.rows[0].id, token } : null;
}
export async function queueDueRequests(client: pg.Client) { return (await client.query<{ id: string }>("select id from review_requests where status='scheduled' and scheduled_at <= now() limit 100")).rows; }
export async function createTestDelivery(client: pg.Client, requestId: string, appUrl: string, tokenSecret: string) {
  const request = await client.query<{ token_ciphertext: string; shop_id: string }>("select token_ciphertext,shop_id from review_requests where id=$1 and status='scheduled' for update", [requestId]);
  if (!request.rowCount) return false;
  const token=await unseal(request.rows[0].token_ciphertext,tokenSecret);
  await client.query("update review_requests set status='sent',sent_at=now(),attempt_count=attempt_count+1,test_email_payload=jsonb_build_object('mode','test','createdAt',now()::text,'reviewUrl',$2,'note','A real delivery provider is intentionally disabled in V1') where id=$1", [requestId,`${appUrl}/review/${token}`]);
  return true;
}
