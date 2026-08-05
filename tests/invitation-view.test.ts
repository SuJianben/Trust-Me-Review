import { describe, expect, it } from "vitest";
import { toInvitationProducts } from "../src/features/requests/invitation-view-service";

describe("invitation view", () => {
  it("keeps each product request ID when converting database rows for the form", () => {
    const products = toInvitationProducts([
      { request_id: "request-a", product_id: "product-a", product_title: "Shirt", status: "sent" },
      { request_id: "request-b", product_id: "product-b", product_title: "Cap", status: "sent" },
    ]);

    expect(products).toEqual([
      { requestId: "request-a", productId: "product-a", productTitle: "Shirt", status: "sent" },
      { requestId: "request-b", productId: "product-b", productTitle: "Cap", status: "sent" },
    ]);
    expect(products.map((product) => product.requestId)).toEqual(["request-a", "request-b"]);
  });
});
