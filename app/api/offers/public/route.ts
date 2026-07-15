import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { attachTodayAvailabilityServer } from "@/lib/services/offerAvailabilityStatusService";

const MAX_LIMIT = 30;

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
          is_deactivated,
          profile_ratings (
            rating_avg,
            rating_count
          )
        )
      `,
        { count: "exact" },
      )
      .eq("publication_status", "active")
      .eq("hidden_by_account_deactivation", false)
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

    const offers = await attachTodayAvailabilityServer(data || []);

    return NextResponse.json({ offers, count: count || 0 });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Nabídky se nepodařilo načíst"), offers: [], count: 0 },
      { status: 400 },
    );
  }
}
