import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sendBookingMessageServer } from "@/lib/services/bookingService";

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

  const { bookingId, message } = await request.json();

  if (!bookingId || !message) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  try {
    const result = await sendBookingMessageServer({
      bookingId,
      actorId: user.id,
      message,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Zprávu se nepodařilo odeslat" },
      { status: 400 }
    );
  }
}