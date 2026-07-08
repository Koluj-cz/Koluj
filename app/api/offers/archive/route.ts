import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { archiveOfferServer } from "@/lib/services/offerService";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `offers:archive:${getClientIp(request)}`,
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  const { user } = await requireUser();


  const { offerId } = await request.json();

  if (!offerId) {
    return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
  }

  try {
    const result = await archiveOfferServer({
      offerId,
      actorId: user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Nabídka se nepodařilo archivovat" },
      { status: 400 }
    );
  }
}