import { NextResponse } from "next/server";
import { requireUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = checkRateLimit({
    key: `push:subscribe:${getClientIp(request)}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const { subscription, userAgent } = await request.json();

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return NextResponse.json(
        { error: "Missing subscription data" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "endpoint",
        },
      );

    if (error) {
      throw new Error(error.message);
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        push_notifications_enabled: true,
      })
      .eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Notifikace se nepodařilo uložit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  const rate = checkRateLimit({
    key: `push:delete:${getClientIp(request)}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const body = await request.json().catch(() => null);
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;

    let query = supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id);

    if (endpoint) {
      query = query.eq("endpoint", endpoint);
    }

    const { error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        push_notifications_enabled: false,
      })
      .eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Notifikace se nepodařilo vypnout");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
