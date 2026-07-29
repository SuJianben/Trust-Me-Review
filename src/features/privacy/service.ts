import type pg from "pg";
import { sha256 } from "../../lib/crypto";

type CustomerPayload = { customer?: { email?: unknown } };

export function extractCustomerEmail(payload: unknown): string | null {
  const email = (payload as CustomerPayload | null)?.customer?.email;
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}

async function privacyAudit(client: pg.Client, shopId: string, action: string, metadata: Record<string, unknown>) {
  await client.query(
    "insert into audit_logs(shop_id,actor_type,action,target_type,metadata) values($1,'shopify',$2,'privacy',$3)",
    [shopId, action, JSON.stringify(metadata)],
  );
}

export async function recordDataRequest(client: pg.Client, shopId: string) {
  await privacyAudit(client, shopId, "privacy_data_request", { received: true });
}

export async function redactCustomerData(client: pg.Client, shopId: string, payload: unknown) {
  const email = extractCustomerEmail(payload);
  if (!email) {
    await privacyAudit(client, shopId, "privacy_customer_redact", { redactedReviews: 0, redactedRequests: 0, reason: "email_missing" });
    return;
  }
  const emailHash = await sha256(email);
  await client.query("begin");
  try {
    const reviews = await client.query(
      `delete from reviews
       where shop_id=$1 and (author_email_hash=$2 or shopify_order_id in (
         select shopify_order_id from review_requests where shop_id=$1 and customer_email_hash=$2
       ))`,
      [shopId, emailHash],
    );
    const requests = await client.query("delete from review_requests where shop_id=$1 and customer_email_hash=$2", [shopId, emailHash]);
    await privacyAudit(client, shopId, "privacy_customer_redact", { redactedReviews: reviews.rowCount, redactedRequests: requests.rowCount });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function cancelOutstandingRequests(client: pg.Client, shopId: string) {
  const cancelled = await client.query(
    `update review_requests
     set status='cancelled', customer_email_hash='redacted', token_ciphertext='redacted', test_email_payload='{}'::jsonb, updated_at=now()
     where shop_id=$1 and status in ('scheduled','sent')`,
    [shopId],
  );
  await privacyAudit(client, shopId, "app_uninstalled", { cancelledRequests: cancelled.rowCount });
}

export async function eraseShopData(client: pg.Client, shopId: string) {
  await client.query("begin");
  try {
    await client.query("delete from webhook_events where shop_id=$1", [shopId]);
    await client.query("delete from analytics_events where shop_id=$1", [shopId]);
    await client.query("delete from shops where id=$1", [shopId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
