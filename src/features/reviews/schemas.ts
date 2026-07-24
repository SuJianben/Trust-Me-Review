import { z } from "zod";
export const publicReviewSchema = z.object({ shopDomain: z.string().min(3), productId: z.string().min(1), rating: z.number().int().min(1).max(5), title: z.string().max(120).optional(), body: z.string().trim().min(10).max(3000), authorName: z.string().trim().min(1).max(120), website: z.string().max(0).optional(), turnstileToken: z.string().min(1) });
export const invitationReviewSchema = publicReviewSchema.omit({ shopDomain: true, productId: true, turnstileToken: true, website: true });
export const moderationSchema = z.object({ status: z.enum(["published", "hidden", "deleted"]), pinned: z.boolean().optional() });
export const replySchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const settingsSchema = z.object({ requestEnabled: z.boolean(), requestDelayDays: z.number().int().min(0).max(90), showVerifiedBadge: z.boolean(), starColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), emailSubjectEn: z.string().min(1).max(200), emailSubjectZh: z.string().min(1).max(200) });
