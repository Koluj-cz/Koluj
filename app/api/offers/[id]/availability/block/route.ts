import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAvailabilityBlockServer } from "@/lib/services/availabilityService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Blokaci se nepodařilo vytvořit" },
      { status: 400 }
    );
  }
}
