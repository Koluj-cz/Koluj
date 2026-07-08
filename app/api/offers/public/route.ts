import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

const MAX_LIMIT = 30;

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
  const rate = await checkRateLimit({
    key: `offers-public:${getClientIp(request)}`,
    limit: 180,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit") || 10)));
    const offerType = url.searchParams.get("offerType") || "all";
    const category = url.searchParams.get("category") || "";
    const search = (url.searchParams.get("q") || "").trim();
    const from = page * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from("offers")
      .select(
        `
        *,
        profiles:profiles!offers_owner_id_fkey (
          full_name,
          avatar_url,
          is_verified,
          profile_ratings (
            rating_avg,
            rating_count
          )
        )
      `,
        { count: "exact" },
      )
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (offerType !== "all") query = query.eq("offer_type", offerType);
    if (category) query = query.eq("category", category);

    if (search) {
      const normalizedSearch = search.replaceAll(",", " ");
      query = query.or(
        `title.ilike.%${normalizedSearch}%,description.ilike.%${normalizedSearch}%,category.ilike.%${normalizedSearch}%,pickup_place.ilike.%${normalizedSearch}%`,
      );
    }

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const offers = await attachTodayAvailability(data || []);

    return NextResponse.json({ offers, count: count || 0 });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Nabídky se nepodařilo načíst"), offers: [], count: 0 },
      { status: 400 },
    );
  }
}
