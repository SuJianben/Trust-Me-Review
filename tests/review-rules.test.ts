import { describe, expect, it } from "vitest";
import { hasProhibitedText } from "../src/features/reviews/service";
import { moderationSchema, publicReviewSchema } from "../src/features/reviews/schemas";
describe("review submission rules", () => {
  it("rejects prohibited content", () => { expect(hasProhibitedText("Visit our CASINO now")).toBe(true); expect(hasProhibitedText("Fits as expected and feels great.")).toBe(false); });
  it("requires anti-bot token and meaningful body", () => { expect(publicReviewSchema.safeParse({shopDomain:"demo.myshopify.com",productId:"1",rating:5,authorName:"Sam",body:"Great product",turnstileToken:"token"}).success).toBe(true); expect(publicReviewSchema.safeParse({shopDomain:"demo.myshopify.com",productId:"1",rating:5,authorName:"Sam",body:"short"}).success).toBe(false); });
  it("allows every moderation state and standalone pin updates", () => {
    expect(moderationSchema.safeParse({ status: "pending" }).success).toBe(true);
    expect(moderationSchema.safeParse({ status: "published" }).success).toBe(true);
    expect(moderationSchema.safeParse({ status: "hidden" }).success).toBe(true);
    expect(moderationSchema.safeParse({ status: "deleted" }).success).toBe(true);
    expect(moderationSchema.safeParse({ pinned: true }).success).toBe(true);
    expect(moderationSchema.safeParse({}).success).toBe(false);
  });
});
