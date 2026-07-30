import { describe, expect, it } from "vitest";
import { productRequestSettingSchema } from "../src/features/products/schemas";

describe("product request setting", () => {
  it("accepts an explicit product-level invitation toggle", () => {
    expect(productRequestSettingSchema.parse({ requestEnabled: false })).toEqual({ requestEnabled: false });
  });

  it("rejects an ambiguous product-level invitation toggle", () => {
    expect(productRequestSettingSchema.safeParse({ requestEnabled: "false" }).success).toBe(false);
  });
});
