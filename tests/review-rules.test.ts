import { describe, expect, it } from "vitest";
import { hasProhibitedText } from "../src/features/reviews/service";
import { publicReviewSchema } from "../src/features/reviews/schemas";
describe("review submission rules", () => {
  it("rejects prohibited content", () => { expect(hasProhibitedText("Visit our CASINO now")).toBe(true); expect(hasProhibitedText("Fits as expected and feels great.")).toBe(false); });
  it("requires anti-bot token and meaningful body", () => { expect(publicReviewSchema.safeParse({shopDomain:"demo.myshopify.com",productId:"1",rating:5,authorName:"Sam",body:"Great product",turnstileToken:"token"}).success).toBe(true); expect(publicReviewSchema.safeParse({shopDomain:"demo.myshopify.com",productId:"1",rating:5,authorName:"Sam",body:"short"}).success).toBe(false); });
});
