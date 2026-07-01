import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { archiveOfferServer } from "@/lib/services/offerService";

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