import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { approveBookingServer } from "@/lib/services/bookingService";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `booking:approve:${getClientIp(request)}`,
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
    const result = await approveBookingServer({
      bookingId,
      actorId: user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Rezervaci se nepodařilo schválit" },
      { status: 400 }
    );
  }
}
