import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { MAX_REVIEW_IMAGES, uploadReviewImage } from "@/lib/services/reviewImageService";

export async function POST(request: Request) {
  const rate = await checkRateLimit({ key: `reviews:post:${getClientIp(request)}`, limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const formData = await request.formData();
    const bookingId = String(formData.get("bookingId") || "");
    const numericRating = Number(formData.get("rating"));
    const comment = String(formData.get("comment") || "").trim().slice(0, 1000);
    const images = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);

    if (!bookingId || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) throw new Error("Vyber hodnocení od 1 do 5");
    if (images.length > MAX_REVIEW_IMAGES) throw new Error(`K recenzi lze přiložit maximálně ${MAX_REVIEW_IMAGES} obrázky`);

    const { data: booking, error: bookingError } = await supabaseAdmin.from("bookings").select("id, offer_id, owner_id, customer_id, status").eq("id", bookingId).single();
    if (bookingError || !booking) throw new Error("Rezervace nebyla nalezena");
    if (booking.owner_id !== user.id && booking.customer_id !== user.id) throw new Error("K této rezervaci nemáš přístup");
    if (booking.status !== "returned") throw new Error("Hodnocení lze přidat až po dokončení rezervace");

    const reviewedUserId = booking.owner_id === user.id ? booking.customer_id : booking.owner_id;
    const { data: review, error } = await supabaseAdmin.from("reviews").insert({
      booking_id: booking.id, offer_id: booking.offer_id, reviewer_id: user.id,
      reviewed_user_id: reviewedUserId, rating: numericRating, comment: comment || null,
    }).select("id").single();
    if (error || !review) throw new Error(error?.message || "Hodnocení se nepodařilo uložit");

    for (let index = 0; index < images.length; index += 1) {
      const storagePath = await uploadReviewImage({ reviewId: review.id, userId: user.id, file: images[index], sortOrder: index });
      const { error: imageError } = await supabaseAdmin.from("review_images").insert({ review_id: review.id, storage_path: storagePath, sort_order: index });
      if (imageError) throw new Error(imageError.message);
    }

    await supabaseAdmin.from("booking_messages").insert({ booking_id: booking.id, sender_id: user.id, is_system: true, message: "Hodnocení bylo odesláno." });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Hodnocení se nepodařilo uložit");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
