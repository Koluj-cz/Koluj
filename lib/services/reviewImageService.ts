import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const REVIEW_IMAGES_BUCKET = "review-images";
export const MAX_REVIEW_IMAGES = 3;
export const MAX_REVIEW_IMAGE_SIZE = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateReviewImage(file: File) {
  if (!file.size) throw new Error("Obrázek je prázdný");
  if (file.size > MAX_REVIEW_IMAGE_SIZE) throw new Error("Jeden obrázek může mít maximálně 8 MB");
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("Povolené jsou obrázky JPG, PNG a WebP");
}

export async function uploadReviewImage(params: { reviewId: string; userId: string; file: File; sortOrder: number }) {
  validateReviewImage(params.file);
  const supabase = createSupabaseAdminClient();
  const extension = params.file.type === "image/png" ? "png" : params.file.type === "image/webp" ? "webp" : "jpg";
  const path = `${params.reviewId}/${params.userId}/${params.sortOrder}-${randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(REVIEW_IMAGES_BUCKET).upload(path, params.file, {
    contentType: params.file.type,
    upsert: false,
  });
  if (error) throw new Error(`Obrázek recenze se nepodařilo nahrát: ${error.message}`);
  return path;
}

export async function createReviewImageSignedUrl(path: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(REVIEW_IMAGES_BUCKET).createSignedUrl(path, 60 * 60);
  return error ? null : data?.signedUrl || null;
}

export async function attachSignedReviewImages<T extends { review_images?: Array<{ id: string; storage_path: string; sort_order: number | null }> | null }>(reviews: T[]) {
  return Promise.all(reviews.map(async (review) => ({
    ...review,
    images: (await Promise.all((review.review_images || []).map(async (image) => ({
      id: image.id,
      url: await createReviewImageSignedUrl(image.storage_path),
      sort_order: image.sort_order,
    })))).filter((image) => Boolean(image.url)),
    review_images: undefined,
  })));
}
