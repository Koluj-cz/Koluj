import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { errorMessage } from "@/lib/security";
import { sendBookingMessageServer } from "@/lib/services/bookingService";

export async function POST(request: Request) {
  const rate = checkRateLimit({
    key: `booking-message:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }
  const { user } = await requireUser();


  const { bookingId, message } = await request.json();
  const normalizedMessage = typeof message === "string" ? message.trim() : "";

  if (!bookingId || !normalizedMessage) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  if (normalizedMessage.length > 1000) {
    return NextResponse.json({ error: "Zpráva je příliš dlouhá" }, { status: 400 });
  }

  try {
    const result = await sendBookingMessageServer({
      bookingId,
      actorId: user.id,
      message: normalizedMessage,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Zprávu se nepodařilo odeslat") },
      { status: 400 }
    );
  }
}