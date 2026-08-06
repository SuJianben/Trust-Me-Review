/**
 * A webhook is queued only when the delivery row was inserted for the first time.
 * PostgreSQL returns zero rows for an ON CONFLICT DO NOTHING duplicate.
 */
export function shouldQueueWebhook(insertedRows: number | null | undefined): boolean {
  return insertedRows === 1;
}

/**
 * These headers are supplied by Shopify for every webhook delivery and are
 * required to route the event and make delivery-idempotency safe.
 */
export function hasRequiredShopifyWebhookHeaders(headers: Headers): boolean {
  return [
    "x-shopify-webhook-id",
    "x-shopify-topic",
    "x-shopify-shop-domain",
  ].every((name) => Boolean(headers.get(name)?.trim()));
}
