import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function GET(request: Request) {
  const rate = checkRateLimit({
    key: `dashboard-availability:get:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("offers")
      .select("id, title, primary_image_url, is_active")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (itemsError) throw new Error(itemsError.message);

    const offerIds = (items || []).map((item) => item.id);

    if (!dateFrom || !dateTo || offerIds.length === 0) {
      return NextResponse.json({ items: items || [], blocks: [], reservations: [] });
    }

    const [blocksResult, reservationsResult] = await Promise.all([
      supabaseAdmin
        .from("offer_availability_blocks")
        .select("id, offer_id, date_from, date_to, reason, offers:offers(title)")
        .in("offer_id", offerIds)
        .lte("date_from", dateTo)
        .gte("date_to", dateFrom)
        .order("date_from", { ascending: true }),
      supabaseAdmin
        .from("offer_reservations")
        .select("id, offer_id, booking_id, date_from, date_to, status, offers:offers(title)")
        .in("offer_id", offerIds)
        .eq("status", "active")
        .lte("date_from", dateTo)
        .gte("date_to", dateFrom)
        .order("date_from", { ascending: true }),
    ]);

    if (blocksResult.error) throw new Error(blocksResult.error.message);
    if (reservationsResult.error) throw new Error(reservationsResult.error.message);

    return NextResponse.json({
      items: items || [],
      blocks: blocksResult.data || [],
      reservations: reservationsResult.data || [],
    });
  } catch (error) {
    const message = errorMessage(error, "Dostupnost se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message, items: [], blocks: [], reservations: [] }, { status });
  }
}
