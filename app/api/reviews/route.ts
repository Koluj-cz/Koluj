import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = checkRateLimit({
    key: `reviews:post:${getClientIp(request)}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const { bookingId, rating, comment } = await request.json();

    const numericRating = Number(rating);
    if (!bookingId || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new Error("Vyber hodnocení od 1 do 5");
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id, offer_id, owner_id, customer_id, status")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) throw new Error("Rezervace nebyla nalezena");
    if (booking.owner_id !== user.id && booking.customer_id !== user.id) {
      throw new Error("K této rezervaci nemáš přístup");
    }

    const reviewedUserId = booking.owner_id === user.id ? booking.customer_id : booking.owner_id;

    const { error } = await supabaseAdmin.from("reviews").insert({
      booking_id: booking.id,
      offer_id: booking.offer_id,
      reviewer_id: user.id,
      reviewed_user_id: reviewedUserId,
      rating: numericRating,
      comment: typeof comment === "string" ? comment.trim().slice(0, 1000) : null,
    });

    if (error) throw new Error(error.message);

    await supabaseAdmin.from("booking_messages").insert({
      booking_id: booking.id,
      sender_id: user.id,
      is_system: true,
      message: "Hodnocení bylo odesláno.",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Hodnocení se nepodařilo uložit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
