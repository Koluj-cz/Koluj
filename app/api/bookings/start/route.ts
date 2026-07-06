import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { startBookingServer } from "@/lib/services/bookingService";

export async function POST(request: Request) {
  const { user } = await requireUser();


  const { bookingId } = await request.json();

  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
  }

  try {
    const result = await startBookingServer({
      bookingId,
      actorId: user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Předání se nepodařilo potvrdit" },
      { status: 400 }
    );
  }
}
