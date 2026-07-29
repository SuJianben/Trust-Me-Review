import type pg from "pg";
import { randomToken, seal, sha256, unseal } from "../../lib/crypto";

export async function createRequest(client: pg.Client, args: { shopId: string; productId: string; orderId: string; variantId?: string; email: string; scheduledAt: Date; tokenSecret: string }) {
  const token = await randomToken(); const tokenHash = await sha256(token); const emailHash = await sha256(args.email.toLowerCase());
  const result = await client.query<{ id: string }>(`insert into review_requests(shop_id,product_id,shopify_order_id,shopify_variant_id,customer_email_hash,token_hash,token_ciphertext,scheduled_at)
    values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(shop_id,shopify_order_id,product_id) do nothing returning id`, [args.shopId,args.productId,args.orderId,args.variantId ?? null,emailHash,tokenHash,await seal(token,args.tokenSecret),args.scheduledAt]);
  return result.rowCount ? { id: result.rows[0].id, token } : null;
}
export async function queueDueRequests(client: pg.Client, shopId?: string) {
  if (shopId) {
    return (await client.query<{ id: string }>("select id from review_requests where shop_id=$1 and status='scheduled' and scheduled_at <= now() limit 100", [shopId])).rows;
  }
  return (await client.query<{ id: string }>("select id from review_requests where status='scheduled' and scheduled_at <= now() limit 100")).rows;
}
export async function createTestDelivery(client: pg.Client, requestId: string, appUrl: string, tokenSecret: string) {
  const request = await client.query<{ token_ciphertext: string; shop_id: string }>("select token_ciphertext,shop_id from review_requests where id=$1 and status='scheduled' for update", [requestId]);
  if (!request.rowCount) return false;
  const token=await unseal(request.rows[0].token_ciphertext,tokenSecret);
  await client.query("update review_requests set status='sent',sent_at=now(),attempt_count=attempt_count+1,failure_reason=null,test_email_payload=jsonb_build_object('mode','test','createdAt',now()::text,'reviewUrl',$2::text,'note','A real delivery provider is intentionally disabled in V1') where id=$1", [requestId,`${appUrl}/review/${token}`]);
  return true;
}

export async function recordTestDeliveryFailure(client: pg.Client, requestId: string, reason: string, isFinalAttempt: boolean) {
  await client.query(
    "update review_requests set status=case when $3 then 'failed'::request_status else status end,scheduled_at=case when $3 then scheduled_at else now() + interval '5 minutes' end,attempt_count=attempt_count+1,failure_reason=$2,updated_at=now() where id=$1",
    [requestId, reason.slice(0, 500), isFinalAttempt],
  );
}

export async function retryFailedTestDelivery(client: pg.Client, shopDomain: string, requestId: string) {
  const result = await client.query<{ id: string }>(`
    update review_requests rr set status='scheduled',scheduled_at=now(),failure_reason=null,updated_at=now()
    from shops s where rr.shop_id=s.id and s.domain=$1 and rr.id=$2 and rr.status='failed'
    returning rr.id`, [shopDomain, requestId]);
  return result.rows[0] ?? null;
}
