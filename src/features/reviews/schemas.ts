import { z } from "zod";
export const publicReviewSchema = z.object({ shopDomain: z.string().min(3), productId: z.string().min(1), productTitle: z.string().trim().max(255).optional(), rating: z.number().int().min(1).max(5), title: z.string().max(120).optional(), body: z.string().trim().min(10).max(3000), authorName: z.string().trim().min(1).max(120), website: z.string().max(0).optional(), turnstileToken: z.string().min(1) });
export const invitationReviewSchema = publicReviewSchema.omit({ shopDomain: true, productId: true, turnstileToken: true, website: true });
export const reviewStatusSchema = z.enum(["pending", "published", "hidden", "deleted"]);
export const moderationSchema = z.object({ status: reviewStatusSchema.optional(), pinned: z.boolean().optional() }).refine(
  (update) => update.status !== undefined || update.pinned !== undefined,
  { message: "Select a review status or update its pin state." },
);
export const replySchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const settingsSchema = z.object({ requestEnabled: z.boolean(), requestDelayDays: z.number().int().min(0).max(90), maxProductsPerOrder: z.number().int().min(1).max(10).default(10), productSelectionStrategy: z.enum(["highest_price", "all_items"]).default("highest_price"), requestSpacingDays: z.number().int().min(0).max(90).default(0), customerRequestCooldownDays: z.number().int().min(0).max(365).default(0), showVerifiedBadge: z.boolean(), starColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), emailSubjectEn: z.string().min(1).max(200), emailSubjectZh: z.string().min(1).max(200) });
export const blocklistEntrySchema = z.object({ email: z.string().trim().email().max(320), note: z.string().trim().max(300).optional() });
