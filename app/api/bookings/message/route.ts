import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { errorMessage } from "@/lib/security";
import { sendBookingMessageServer } from "@/lib/services/bookingService";

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `booking-message:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const formData = await request.formData();
    const bookingId = String(formData.get("bookingId") || "");
    const message = String(formData.get("message") || "").trim();
    const attachmentValue = formData.get("attachment");
    const attachment = attachmentValue instanceof File && attachmentValue.size > 0
      ? attachmentValue
      : null;

    if (!bookingId || (!message && !attachment)) {
      return NextResponse.json({ error: "Napiš zprávu nebo přilož soubor" }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: "Zpráva je příliš dlouhá" }, { status: 400 });
    }

    const result = await sendBookingMessageServer({
      bookingId,
      actorId: user.id,
      message,
      attachment,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Zprávu se nepodařilo odeslat") },
      { status: 400 },
    );
  }
}
