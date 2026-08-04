import { describe, expect, it } from "vitest";
import { settingsSchema } from "../src/features/reviews/schemas";

const validSettings = {
  requestEnabled: true,
  requestDelayDays: 14,
  maxProductsPerOrder: 10,
  productSelectionStrategy: "highest_price",
  requestSpacingDays: 0,
  customerRequestCooldownDays: 0,
  showVerifiedBadge: true,
  starColor: "#F59E0B",
  emailSubjectEn: "How was your purchase?",
  emailSubjectZh: "您的购买体验如何？",
};

describe("settings schema", () => {
  it("accepts the invitation settings exposed in the admin", () => {
    expect(settingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it("defaults to all products per order and no cross-order cooldown", () => {
    const { maxProductsPerOrder: _max, requestSpacingDays: _spacing, customerRequestCooldownDays: _cooldown, ...withoutSchedulingDefaults } = validSettings;
    const parsed = settingsSchema.parse(withoutSchedulingDefaults);
    expect(parsed.maxProductsPerOrder).toBe(10);
    expect(parsed.requestSpacingDays).toBe(0);
    expect(parsed.customerRequestCooldownDays).toBe(0);
  });

  it("rejects a fulfillment delay beyond the supported range", () => {
    expect(settingsSchema.safeParse({ ...validSettings, requestDelayDays: 91 }).success).toBe(false);
  });

  it("rejects a customer request limit beyond the supported range", () => {
    expect(settingsSchema.safeParse({ ...validSettings, customerRequestCooldownDays: 366 }).success).toBe(false);
  });
});
