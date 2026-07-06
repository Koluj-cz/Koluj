import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { errorMessage } from "@/lib/security";
import { requestBookingServer } from "@/lib/services/bookingService";

export async function POST(request: Request) {
  const rate = checkRateLimit({
    key: `booking-request:${getClientIp(request)}`,
    limit: 20,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }
  const { user } = await requireUser();


  const { offerId, dateFrom, dateTo, startsAt, endsAt, note } = await request.json();
  const normalizedNote = typeof note === "string" ? note.trim().slice(0, 500) : "";

  if (!offerId) {
    return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
  }

  try {
    const result = await requestBookingServer({
      offerId,
      customerId: user.id,
      dateFrom,
      dateTo,
      startsAt,
      endsAt,
      note: normalizedNote,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Žádost se nepodařilo vytvořit") },
      { status: 400 }
    );
  }
}
