import { describe, expect, it } from "vitest";
import { hasProhibitedText } from "../src/features/reviews/service";
import { invitationBatchReviewSchema, moderationSchema, publicReviewSchema } from "../src/features/reviews/schemas";
describe("review submission rules", () => {
  it("rejects prohibited content", () => { expect(hasProhibitedText("Visit our CASINO now")).toBe(true); expect(hasProhibitedText("Fits as expected and feels great.")).toBe(false); });
  it("requires anti-bot token and meaningful body", () => { expect(publicReviewSchema.safeParse({shopDomain:"demo.myshopify.com",productId:"1",productTitle:"Demo product",rating:5,authorName:"Sam",body:"Great product",turnstileToken:"token"}).success).toBe(true); expect(publicReviewSchema.safeParse({shopDomain:"demo.myshopify.com",productId:"1",rating:5,authorName:"Sam",body:"short"}).success).toBe(false); });
  it("allows every moderation state and standalone pin updates", () => {
    expect(moderationSchema.safeParse({ status: "pending" }).success).toBe(true);
    expect(moderationSchema.safeParse({ status: "published" }).success).toBe(true);
    expect(moderationSchema.safeParse({ status: "hidden" }).success).toBe(true);
    expect(moderationSchema.safeParse({ status: "deleted" }).success).toBe(true);
    expect(moderationSchema.safeParse({ pinned: true }).success).toBe(true);
    expect(moderationSchema.safeParse({}).success).toBe(false);
  });
  it("allows a verified order invitation to submit several products with optional titles", () => {
    const payload = { authorName: "Jordan", reviews: [
      { requestId: "5c636458-c28b-4f26-aaca-42df2ddd4ee3", rating: 5, title: "", body: "Fits perfectly" },
      { requestId: "32bcae75-3c66-4058-8d32-235617a87a93", rating: 4, body: "Great quality" },
    ] };
    const result = invitationBatchReviewSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reviews[0].title).toBeUndefined();
  });
  it("requires review text and rejects duplicate product submissions in one invitation batch", () => {
    const requestId = "5c636458-c28b-4f26-aaca-42df2ddd4ee3";
    expect(invitationBatchReviewSchema.safeParse({ authorName: "Jordan", reviews: [{ requestId, rating: 5, body: "" }] }).success).toBe(false);
    expect(invitationBatchReviewSchema.safeParse({ authorName: "Jordan", reviews: [{ requestId, rating: 5, body: "Great" }, { requestId, rating: 4, body: "Also great" }] }).success).toBe(false);
  });
});
