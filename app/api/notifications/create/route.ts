import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { notifyUserServer } from "@/lib/notifyUserServer";

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
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();

    const {
    userId,
    loanId,
    itemId,
    type,
    title,
    message,
    emailSubject,
    sendEmail = true,
    sendPush = true,
    url,
    } = body;

  if (!userId || !type || !title || !message) {
    return NextResponse.json(
      { error: "Missing notification data" },
      { status: 400 }
    );
  }

  await notifyUserServer({
    userId,
    actorId: user.id,
    loanId,
    itemId,
    type,
    title,
    message,
    emailSubject,
    sendEmail,
    sendPush,
    url,
  });

  return NextResponse.json({ ok: true });
}