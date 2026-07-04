import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { errorMessage } from "@/lib/security";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
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

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
