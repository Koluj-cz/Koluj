import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { requireUser } from "@/lib/supabase/server";
import { createAvailabilityBlockServer } from "@/lib/services/availabilityService";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = await checkRateLimit({
    key: `offer-availability:block:create:${getClientIp(request)}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  const { id } = await params;
  const { user } = await requireUser();


  const { dateFrom, dateTo, startsAt, endsAt, reason } = await request.json();

  if ((!dateFrom || !dateTo) && (!startsAt || !endsAt)) {
    return NextResponse.json(
      { error: "Vyber termín blokace." },
      { status: 400 }
    );
  }

  try {
    const block = await createAvailabilityBlockServer({
      offerId: id,
      ownerId: user.id,
      dateFrom,
      dateTo,
      startsAt,
      endsAt,
      reason,
    });

    return NextResponse.json({ ok: true, block });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Blokaci se nepodařilo vytvořit") },
      { status: 400 }
    );
  }
}
