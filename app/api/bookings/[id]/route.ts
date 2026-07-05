import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rate = checkRateLimit({
    key: `booking-detail:${id}:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(`
        *,
        offers:offers (
          id,
          title,
          primary_image_url,
          pickup_place,
          price_amount,
          price_unit,
          deposit,
          offer_type
        ),
        owner:profiles!bookings_owner_id_fkey (
          id,
          full_name,
          avatar_url
        ),
        customer:profiles!bookings_customer_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq("id", id)
      .single();

    if (bookingError || !booking) throw new Error("Rezervace nebyla nalezena");
    if (booking.owner_id !== user.id && booking.customer_id !== user.id) {
      throw new Error("K této rezervaci nemáš přístup");
    }

    const { data: existingReview } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("booking_id", id)
      .eq("reviewer_id", user.id)
      .maybeSingle();

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("booking_messages")
      .select(`
        *,
        profiles (
          full_name
        )
      `)
      .eq("booking_id", id)
      .order("created_at");

    if (messagesError) throw new Error(messagesError.message);

    return NextResponse.json({
      booking,
      messages: messages || [],
      reviewed: Boolean(existingReview),
      userId: user.id,
    });
  } catch (error) {
    const message = errorMessage(error, "Rezervace se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
