import type pg from "pg";
import { randomToken, seal, sha256, unseal } from "../../lib/crypto";

export async function createRequest(client: pg.Client, args: { shopId: string; productId: string; orderId: string; variantId?: string; email: string; scheduledAt: Date; tokenSecret: string }) {
  const token = await randomToken(); const tokenHash = await sha256(token); const emailHash = await sha256(args.email.toLowerCase());
  const result = await client.query<{ id: string }>(`insert into review_requests(shop_id,product_id,shopify_order_id,shopify_variant_id,customer_email_hash,token_hash,token_ciphertext,scheduled_at)
    values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(shop_id,shopify_order_id,product_id) do nothing returning id`, [args.shopId,args.productId,args.orderId,args.variantId ?? null,emailHash,tokenHash,await seal(token,args.tokenSecret),args.scheduledAt]);
  return result.rowCount ? { id: result.rows[0].id, token } : null;
}

/** Return one queue item per order, not one queue item per product. */
export async function queueDueRequests(client: pg.Client, shopId?: string) {
  if (shopId) {
    return (await client.query<{ id: string }>(`select (array_agg(id order by created_at, id))[1]::text as id
      from review_requests
      where shop_id=$1 and status='scheduled' and scheduled_at <= now()
      group by shop_id, shopify_order_id
      order by min(scheduled_at), min(created_at)
      limit 100`, [shopId])).rows;
  }
  return (await client.query<{ id: string }>(`select (array_agg(id order by created_at, id))[1]::text as id
    from review_requests
    where status='scheduled' and scheduled_at <= now()
    group by shop_id, shopify_order_id
    order by min(scheduled_at), min(created_at)
    limit 100`)).rows;
}

type TestReviewLink = { requestId: string; productId: string; productTitle: string; reviewUrl: string };

export type TestEmailPayload = {
  mode: "test";
  createdAt: string;
  reviewUrl?: string;
  reviewUrls: TestReviewLink[];
  note: string;
};

/**
 * Create one test invitation envelope for every due product request in an
 * order. Each product keeps its own one-time link inside the shared payload.
 */
export async function createTestDelivery(client: pg.Client, requestId: string, appUrl: string, tokenSecret: string) {
  await client.query("begin");
  try {
    const request = await client.query<{ shop_id: string; shopify_order_id: string }>("select shop_id,shopify_order_id from review_requests where id=$1 and status='scheduled' for update", [requestId]);
    if (!request.rowCount) { await client.query("rollback"); return false; }
    const items = await client.query<{ id: string; token_ciphertext: string; shopify_product_id: string; title_snapshot: string }>(`
      select rr.id,rr.token_ciphertext,p.shopify_product_id,p.title_snapshot
      from review_requests rr join products p on p.id=rr.product_id
      where rr.shop_id=$1 and rr.shopify_order_id=$2 and rr.status='scheduled'
      order by rr.created_at asc
      for update`, [request.rows[0].shop_id, request.rows[0].shopify_order_id]);
    if (!items.rowCount) { await client.query("rollback"); return false; }
    const reviewUrls: TestReviewLink[] = [];
    for (const item of items.rows) {
      const token = await unseal(item.token_ciphertext, tokenSecret);
      reviewUrls.push({ requestId: item.id, productId: item.shopify_product_id, productTitle: item.title_snapshot, reviewUrl: `${appUrl}/review/${token}` });
    }
    const payload: TestEmailPayload = {
      mode: "test",
      createdAt: new Date().toISOString(),
      reviewUrl: reviewUrls[0]?.reviewUrl,
      reviewUrls,
      note: "A real delivery provider is intentionally disabled in V1",
    };
    const updated = await client.query(`update review_requests
      set status='sent',sent_at=now(),attempt_count=attempt_count+1,failure_reason=null,
          test_email_payload=$3::jsonb,updated_at=now()
      where shop_id=$1 and shopify_order_id=$2 and status='scheduled'
      returning id`, [request.rows[0].shop_id, request.rows[0].shopify_order_id, JSON.stringify(payload)]);
    if (!updated.rowCount) { await client.query("rollback"); return false; }
    await client.query("insert into analytics_events(shop_id,event_name,properties) values($1,'review_request_order_delivery_sent',$2)", [request.rows[0].shop_id, JSON.stringify({ orderId: request.rows[0].shopify_order_id, productCount: reviewUrls.length, mode: "test" })]);
    await client.query("commit");
    return true;
  } catch (error) {
    try { await client.query("rollback"); } catch { /* preserve the original delivery error */ }
    throw error;
  }
}

/** Mark every still-scheduled product request in the same order together. */
export async function recordTestDeliveryFailure(client: pg.Client, requestId: string, reason: string, isFinalAttempt: boolean) {
  const request = await client.query<{ shop_id: string; shopify_order_id: string }>("select shop_id,shopify_order_id from review_requests where id=$1", [requestId]);
  if (!request.rowCount) return;
  await client.query(
    `update review_requests set
      status=case when $3 then 'failed'::request_status else status end,
      scheduled_at=case when $3 then scheduled_at else now() + interval '5 minutes' end,
      attempt_count=attempt_count+1,failure_reason=$4,updated_at=now()
      where shop_id=$1 and shopify_order_id=$2 and status='scheduled'`,
    [request.rows[0].shop_id, request.rows[0].shopify_order_id, isFinalAttempt, reason.slice(0, 500)],
  );
}

/** Retry every failed product request belonging to the same order. */
export async function retryFailedTestDelivery(client: pg.Client, shopDomain: string, requestId: string) {
  const result = await client.query<{ id: string }>(`
    with target as (
      select rr.shop_id,rr.shopify_order_id
      from review_requests rr join shops s on s.id=rr.shop_id
      where s.domain=$1 and rr.id=$2 and rr.status='failed'
    )
    update review_requests rr set status='scheduled',scheduled_at=now(),failure_reason=null,updated_at=now()
    from target where rr.shop_id=target.shop_id and rr.shopify_order_id=target.shopify_order_id and rr.status='failed'
    returning rr.id`, [shopDomain, requestId]);
  return result.rows[0] ?? null;
}
