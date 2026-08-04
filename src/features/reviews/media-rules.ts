export const MAX_IMAGES_PER_REVIEW = 5;
export const MAX_VIDEOS_PER_REVIEW = 1;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

export type ReviewMediaKind = "image" | "video";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function getReviewMediaKind(contentType: string): ReviewMediaKind | null {
  if (imageTypes.has(contentType)) return "image";
  return contentType === "video/mp4" ? "video" : null;
}

export function validateReviewMedia(contentType: string, byteSize: number) {
  const kind = getReviewMediaKind(contentType);
  if (!kind) return { ok: false as const, error: "Only JPG, PNG, WebP images and MP4 videos are supported." };
  const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (!Number.isFinite(byteSize) || byteSize < 1 || byteSize > limit) {
    return { ok: false as const, error: kind === "image" ? "Each image must be 2 MB or smaller after compression." : "Each video must be 10 MB or smaller." };
  }
  return { ok: true as const, kind };
}

export function canAddReviewMedia(existing: readonly ReviewMediaKind[], next: ReviewMediaKind) {
  const imageCount = existing.filter((kind) => kind === "image").length;
  const videoCount = existing.filter((kind) => kind === "video").length;
  if (next === "image" && imageCount >= MAX_IMAGES_PER_REVIEW) return "You can add up to 5 images for each product.";
  if (next === "video" && videoCount >= MAX_VIDEOS_PER_REVIEW) return "You can add 1 video for each product.";
  return null;
}
