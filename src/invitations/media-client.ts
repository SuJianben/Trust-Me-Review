import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_REVIEW, MAX_VIDEO_BYTES, MAX_VIDEOS_PER_REVIEW, getReviewMediaKind, type ReviewMediaKind } from "../features/reviews/media-rules";

export type LocalReviewMedia = {
  id: string;
  kind: ReviewMediaKind;
  fileName: string;
  previewUrl: string;
};

export async function compressReviewImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.84, 0.76, 0.68, 0.58]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.size <= MAX_IMAGE_BYTES) return new File([blob], `${file.name.replace(/\.[^/.]+$/, "") || "review-image"}.webp`, { type: "image/webp" });
  }
  throw new Error("This image is still larger than 2 MB after compression. Please choose a smaller image.");
}

export async function uploadReviewMedia(token: string, requestId: string, file: File): Promise<{ id: string; kind: ReviewMediaKind }> {
  const form = new FormData();
  form.set("requestId", requestId);
  form.set("file", file);
  const response = await fetch(`/api/invitations/${token}/media`, { method: "POST", body: form });
  const result = await response.json().catch(() => ({})) as { id?: string; kind?: ReviewMediaKind; error?: string };
  if (!response.ok || !result.id || !result.kind) throw new Error(result.error ?? "Unable to upload this file.");
  return { id: result.id, kind: result.kind };
}

export async function removeReviewMedia(token: string, id: string) {
  const response = await fetch(`/api/invitations/${token}/media/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Unable to remove this file. Please try again.");
}

export function validateLocalMediaSelection(current: readonly LocalReviewMedia[], file: File) {
  const kind = getReviewMediaKind(file.type);
  if (!kind) return "Choose a JPG, PNG, WebP image, or an MP4 video.";
  const imageCount = current.filter((media) => media.kind === "image").length;
  const videoCount = current.filter((media) => media.kind === "video").length;
  if (kind === "image" && imageCount >= MAX_IMAGES_PER_REVIEW) return "You can add up to 5 images for each product.";
  if (kind === "video" && videoCount >= MAX_VIDEOS_PER_REVIEW) return "You can add 1 video for each product.";
  if (kind === "video" && file.size > MAX_VIDEO_BYTES) return "Each video must be 10 MB or smaller.";
  return null;
}
