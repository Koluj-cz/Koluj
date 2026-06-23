import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json();

  const { userId, subscription, userAgent } = body;

  if (!userId || !subscription?.endpoint) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent || null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "endpoint",
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}