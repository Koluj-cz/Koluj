import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const MAX_BOOKING_ATTACHMENT_SIZE = 15 * 1024 * 1024;
export const BOOKING_ATTACHMENTS_BUCKET = "booking-attachments";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "pdf",
  "zip",
  "docx",
  "xlsx",
]);

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "priloha";
}

export function validateBookingAttachment(file: File) {
  if (file.size <= 0) throw new Error("Příloha je prázdná");
  if (file.size > MAX_BOOKING_ATTACHMENT_SIZE) {
    throw new Error("Příloha může mít maximálně 15 MB");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_MIME_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Povolené jsou obrázky JPG, PNG, WebP, PDF, DOCX, XLSX a ZIP");
  }
}

export async function uploadBookingAttachment({
  bookingId,
  userId,
  file,
}: {
  bookingId: string;
  userId: string;
  file: File;
}) {
  validateBookingAttachment(file);

  const supabaseAdmin = createSupabaseAdminClient();
  const cleanName = safeFileName(file.name);
  const storagePath = `${bookingId}/${userId}/${Date.now()}-${randomUUID()}-${cleanName}`;

  const { error } = await supabaseAdmin.storage
    .from(BOOKING_ATTACHMENTS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(`Přílohu se nepodařilo nahrát: ${error.message}`);

  return {
    attachment_path: storagePath,
    attachment_name: file.name.slice(0, 255),
    attachment_type: file.type,
    attachment_size: file.size,
  };
}

export async function removeBookingAttachment(path: string | null | undefined) {
  if (!path) return;
  const supabaseAdmin = createSupabaseAdminClient();
  await supabaseAdmin.storage.from(BOOKING_ATTACHMENTS_BUCKET).remove([path]);
}

export async function createBookingAttachmentSignedUrl(path: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.storage
    .from(BOOKING_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
