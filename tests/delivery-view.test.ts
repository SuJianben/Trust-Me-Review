import { describe, expect, it } from "vitest";
import { groupTestDeliveryRows } from "../src/features/requests/delivery-view-service";

describe("order-based test delivery view", () => {
  it("groups product request rows into one order invitation with multiple links", () => {
    const payload = {
      mode: "test",
      createdAt: "2026-08-04T00:00:00.000Z",
      reviewUrls: [
        { requestId: "r1", productId: "p-1", productTitle: "Shirt", reviewUrl: "https://app/review/a" },
        { requestId: "r2", productId: "p-2", productTitle: "Cap", reviewUrl: "https://app/review/b" },
      ],
      note: "test",
    };
    const result = groupTestDeliveryRows([
      { id: "r1", shopify_order_id: "o-1", status: "sent", scheduled_at: "2026-08-04T00:00:00.000Z", sent_at: "2026-08-04T00:01:00.000Z", attempt_count: 1, failure_reason: null, test_email_payload: payload, shopify_product_id: "p-1", title_snapshot: "Shirt" },
      { id: "r2", shopify_order_id: "o-1", status: "sent", scheduled_at: "2026-08-04T00:00:00.000Z", sent_at: "2026-08-04T00:01:00.000Z", attempt_count: 1, failure_reason: null, test_email_payload: payload, shopify_product_id: "p-2", title_snapshot: "Cap" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].products.map((product) => product.reviewUrl)).toEqual(["https://app/review/a", "https://app/review/b"]);
    expect(result[0].status).toBe("sent");
  });

  it("keeps an order scheduled when one of its product rows is still scheduled", () => {
    const result = groupTestDeliveryRows([
      { id: "r1", shopify_order_id: "o-2", status: "sent", scheduled_at: "2026-08-04T00:00:00.000Z", sent_at: "2026-08-04T00:01:00.000Z", attempt_count: 1, failure_reason: null, test_email_payload: null, shopify_product_id: "p-1", title_snapshot: "Shirt" },
      { id: "r2", shopify_order_id: "o-2", status: "scheduled", scheduled_at: "2026-08-04T00:00:00.000Z", sent_at: null, attempt_count: 0, failure_reason: null, test_email_payload: null, shopify_product_id: "p-2", title_snapshot: "Cap" },
    ]);
    expect(result[0].status).toBe("scheduled");
    expect(result[0].products).toHaveLength(2);
  });
});
