import { describe, expect, it } from "vitest";
import { app } from "../src/worker";
import { validWebhook } from "../src/services/shopify";
import { shouldQueueWebhook } from "../src/features/webhooks/security";

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

  it("does not enqueue a duplicate delivery", () => {
    expect(shouldQueueWebhook(1)).toBe(true);
    expect(shouldQueueWebhook(0)).toBe(false);
    expect(shouldQueueWebhook(null)).toBe(false);
    expect(shouldQueueWebhook(undefined)).toBe(false);
  });
});
