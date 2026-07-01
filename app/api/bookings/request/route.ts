import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requestBookingServer } from "@/lib/services/bookingService";

export async function POST(request: Request) {
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
      note,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Žádost se nepodařilo vytvořit" },
      { status: 400 }
    );
  }
}
