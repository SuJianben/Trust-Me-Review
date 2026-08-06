import { describe, expect, it } from "vitest";
import { app } from "../src/worker";
import { validWebhook } from "../src/services/shopify";
import { hasRequiredShopifyWebhookHeaders, shouldQueueWebhook } from "../src/features/webhooks/security";
import { MAX_QUEUE_ATTEMPTS, shouldRetryQueueMessage } from "../src/features/webhooks/queue-policy";

const secret = "shopify-webhook-test-secret";

async function sign(body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

describe("Shopify webhook security", () => {
  it("accepts the HMAC generated from the exact raw request body", async () => {
    const body = '{"id":123,"topic":"customers/data_request"}';
    const request = new Request("https://example.com/webhooks/shopify", {
      headers: { "x-shopify-hmac-sha256": await sign(body) },
    });

    await expect(validWebhook(request, body, secret)).resolves.toBe(true);
    await expect(validWebhook(request, `${body} `, secret)).resolves.toBe(false);
  });

  it("rejects a missing or forged signature", async () => {
    const body = "not-json";
    const missing = new Request("https://example.com/webhooks/shopify");
    const forged = new Request("https://example.com/webhooks/shopify", {
      headers: { "x-shopify-hmac-sha256": "invalid-signature" },
    });

    await expect(validWebhook(missing, body, secret)).resolves.toBe(false);
    await expect(validWebhook(forged, body, secret)).resolves.toBe(false);
  });

  it("fails closed when the webhook secret is missing", async () => {
    const body = "{}";
    const request = new Request("https://example.com/webhooks/shopify", {
      headers: { "x-shopify-hmac-sha256": await sign(body) },
    });

    await expect(validWebhook(request, body, "")).resolves.toBe(false);
    await expect(validWebhook(request, body, undefined as never)).resolves.toBe(false);
  });

  it("returns 401 before parsing an invalid webhook payload", async () => {
    const response = await app.request(
      "https://example.com/webhooks/shopify",
      {
        method: "POST",
        body: "{ definitely-not-json",
        headers: {
          "content-type": "application/json",
          "x-shopify-hmac-sha256": "invalid-signature",
          "x-shopify-webhook-id": "security-test-invalid-payload",
          "x-shopify-topic": "customers/data_request",
          "x-shopify-shop-domain": "trust-me-review-test.myshopify.com",
        },
      },
      { SHOPIFY_API_SECRET: secret } as never,
    );

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Invalid HMAC");
  });

  it("rejects a correctly signed request when Shopify routing headers are missing", async () => {
    const body = '{"id":123}';
    const response = await app.request(
      "https://example.com/webhooks/shopify",
      {
        method: "POST",
        body,
        headers: { "x-shopify-hmac-sha256": await sign(body) },
      },
      { SHOPIFY_API_SECRET: secret } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Missing Shopify webhook headers");
  });

  it("returns 400 instead of throwing when a correctly signed payload is invalid JSON", async () => {
    const body = "{ definitely-not-json";
    const response = await app.request(
      "https://example.com/webhooks/shopify",
      {
        method: "POST",
        body,
        headers: {
          "x-shopify-hmac-sha256": await sign(body),
          "x-shopify-webhook-id": "security-test-invalid-payload",
          "x-shopify-topic": "customers/data_request",
          "x-shopify-shop-domain": "trust-me-review-test.myshopify.com",
        },
      },
      { SHOPIFY_API_SECRET: secret } as never,
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Invalid JSON");
  });

  it("requires all three Shopify routing headers", () => {
    const complete = new Headers({
      "x-shopify-webhook-id": "delivery-1",
      "x-shopify-topic": "orders/fulfilled",
      "x-shopify-shop-domain": "trust-me-review-test.myshopify.com",
    });
    expect(hasRequiredShopifyWebhookHeaders(complete)).toBe(true);
    complete.delete("x-shopify-webhook-id");
    expect(hasRequiredShopifyWebhookHeaders(complete)).toBe(false);
  });

  it("does not enqueue a duplicate delivery", () => {
    expect(shouldQueueWebhook(1)).toBe(true);
    expect(shouldQueueWebhook(0)).toBe(false);
    expect(shouldQueueWebhook(null)).toBe(false);
    expect(shouldQueueWebhook(undefined)).toBe(false);
  });

  it("stops retrying a queue message at the configured final attempt", () => {
    expect(MAX_QUEUE_ATTEMPTS).toBe(5);
    expect(shouldRetryQueueMessage(0)).toBe(true);
    expect(shouldRetryQueueMessage(4)).toBe(true);
    expect(shouldRetryQueueMessage(5)).toBe(false);
    expect(shouldRetryQueueMessage(6)).toBe(false);
    expect(shouldRetryQueueMessage(Number.NaN)).toBe(false);
  });
});
