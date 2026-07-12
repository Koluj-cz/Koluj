import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { errorMessage } from "@/lib/security";
import { requestBookingServer } from "@/lib/services/bookingService";

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `booking-request:${getClientIp(request)}`,
    limit: 20,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const formData = await request.formData();
    const offerId = String(formData.get("offerId") || "");
    const dateFrom = String(formData.get("dateFrom") || "") || undefined;
    const dateTo = String(formData.get("dateTo") || "") || undefined;
    const startsAt = String(formData.get("startsAt") || "") || undefined;
    const endsAt = String(formData.get("endsAt") || "") || undefined;
    const note = String(formData.get("note") || "").trim().slice(0, 500);
    const attachmentValue = formData.get("attachment");
    const attachment = attachmentValue instanceof File && attachmentValue.size > 0
      ? attachmentValue
      : null;

    if (!offerId) {
      return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
    }

    const result = await requestBookingServer({
      offerId,
      customerId: user.id,
      dateFrom,
      dateTo,
      startsAt,
      endsAt,
      note,
      attachment,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Žádost se nepodařilo vytvořit") },
      { status: 400 },
    );
  }
}
