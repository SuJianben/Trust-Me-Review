import { describe, expect, it } from "vitest";
import { extractCustomerEmail } from "../src/features/privacy/service";

describe("privacy payload parsing", () => {
  it("normalizes the customer email before it is hashed", () => {
    expect(extractCustomerEmail({ customer: { email: "  Person@Example.COM " } })).toBe("person@example.com");
  });

  it("does not infer an email when the Shopify payload omits it", () => {
    expect(extractCustomerEmail({ customer: {} })).toBeNull();
    expect(extractCustomerEmail({})).toBeNull();
  });
});
