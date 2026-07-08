import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

const LIMIT = 8;

export async function GET(request: Request) {
  const rate = await checkRateLimit({
    key: `notifications:get:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const url = new URL(request.url);
    const markAsRead = url.searchParams.get("markAsRead") === "true";

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select(`
        *,
        actor:profiles!notifications_actor_id_fkey (
          full_name,
          avatar_url
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIMIT);

    if (error) throw new Error(error.message);

    if (markAsRead) {
      const { error: updateError } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (updateError) throw new Error(updateError.message);
    }

    const notifications = markAsRead
      ? (data || []).map((notification) => ({ ...notification, is_read: true }))
      : data || [];

    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.is_read).length,
    });
  } catch (error) {
    const message = errorMessage(error, "Notifikace se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message, notifications: [], unreadCount: 0 }, { status });
  }
}
