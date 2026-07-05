import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

async function attachTodayAvailability<T extends { id: string }>(items: T[]) {
  if (items.length === 0) return items.map((item) => ({ ...item, is_reserved_today: false }));

  const supabaseAdmin = createSupabaseAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const offerIds = items.map((item) => item.id);

  const [reservationsResult, blocksResult] = await Promise.all([
    supabaseAdmin
      .from("offer_reservations")
      .select("offer_id")
      .in("offer_id", offerIds)
      .eq("status", "active")
      .lte("date_from", today)
      .gte("date_to", today),
    supabaseAdmin
      .from("offer_availability_blocks")
      .select("offer_id")
      .in("offer_id", offerIds)
      .lte("date_from", today)
      .gte("date_to", today),
  ]);

  if (reservationsResult.error) throw new Error(reservationsResult.error.message);
  if (blocksResult.error) throw new Error(blocksResult.error.message);

  const reservedIds = new Set([
    ...(reservationsResult.data || []).map((row) => row.offer_id),
    ...(blocksResult.data || []).map((row) => row.offer_id),
  ]);

  return items.map((item) => ({ ...item, is_reserved_today: reservedIds.has(item.id) }));
}

export async function GET(request: Request) {
  const rate = checkRateLimit({
    key: `dashboard-my-offers:get:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const { data, error } = await supabaseAdmin
      .from("offers")
      .select(`
        *,
        bookings:bookings!bookings_offer_id_fkey (
          id,
          owner_earnings
        )
      `)
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const offers = await attachTodayAvailability(data || []);
    return NextResponse.json({ offers });
  } catch (error) {
    const message = errorMessage(error, "Nabídky se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message, offers: [] }, { status });
  }
}

export async function PATCH(request: Request) {
  const rate = checkRateLimit({
    key: `dashboard-my-offers:patch:${getClientIp(request)}`,
    limit: 80,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const { offerId, isActive } = await request.json();

    if (!offerId || typeof isActive !== "boolean") {
      throw new Error("Chybí data nabídky");
    }

    const { error } = await supabaseAdmin
      .from("offers")
      .update({ is_active: isActive })
      .eq("id", offerId)
      .eq("owner_id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, isActive });
  } catch (error) {
    const message = errorMessage(error, "Nabídku se nepodařilo upravit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
