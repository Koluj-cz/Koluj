import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id, owner_id, customer_id")
      .eq("id", id)
      .single();

    if (bookingError || !booking) throw new Error("Rezervace nebyla nalezena");
    if (booking.owner_id !== user.id && booking.customer_id !== user.id) {
      throw new Error("K této rezervaci nemáš přístup");
    }

    const { error } = await supabaseAdmin.from("booking_participant_presence").upsert({
      booking_id: id,
      user_id: user.id,
      last_seen_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Aktivitu se nepodařilo uložit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
