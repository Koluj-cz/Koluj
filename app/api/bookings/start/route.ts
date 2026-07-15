import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { requireUser } from "@/lib/supabase/server";
import { startBookingServer } from "@/lib/services/bookingService";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `booking:start:${getClientIp(request)}`,
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

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
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Předání se nepodařilo potvrdit") },
      { status: 400 }
    );
  }
}
