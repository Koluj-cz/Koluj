import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sendLoanMessageServer } from "@/lib/services/loanService";

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

  const { loanId, message } = await request.json();

  if (!loanId || !message) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  try {
    const result = await sendLoanMessageServer({
      loanId,
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