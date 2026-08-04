import { describe, expect, it } from "vitest";
import { scheduledAtForOrder, selectOrderItems } from "../src/features/requests/scheduling-service";

describe("review request scheduling rules", () => {
  const items = [
    { product_id: 1, title: "Lower price", price: "19.00" },
    { product_id: 2, title: "Highest price", price: "99.00" },
    { product_id: 3, title: "Middle price", price: "49.00" },
  ];

  it("chooses the highest-priced products first when the order limit applies", () => {
    expect(selectOrderItems(items, "highest_price", 2).map((item) => item.product_id)).toEqual([2, 3]);
  });

  it("keeps Shopify line-item order when that strategy is selected", () => {
    expect(selectOrderItems(items, "all_items", 2).map((item) => item.product_id)).toEqual([1, 2]);
  });

  it("uses one scheduled time for every product in an order", () => {
    const base = new Date("2026-08-04T00:00:00.000Z");
    expect(scheduledAtForOrder(base, 5).toISOString()).toBe("2026-08-09T00:00:00.000Z");
  });

  it("can include all three products from a normal order", () => {
    expect(selectOrderItems(items, "highest_price", 10).map((item) => item.product_id)).toEqual([2, 3, 1]);
  });
});
