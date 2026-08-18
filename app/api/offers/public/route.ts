import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { attachTodayAvailabilityServer } from "@/lib/services/offerAvailabilityStatusService";
import { sanitizeOfferPrimaryImages } from "@/lib/services/offerPrimaryImageService";
import { buildServerSearchTerms } from "@/lib/services/searchService";

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
    const dateFrom = (url.searchParams.get("dateFrom") || "").trim();
    const dateTo = (url.searchParams.get("dateTo") || dateFrom).trim();
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

    if (dateFrom && dateTo) {
      const [reservationsResult, blocksResult, bookingsResult] = await Promise.all([
        supabaseAdmin
          .from("offer_reservations")
          .select("offer_id")
          .eq("status", "active")
          .lte("date_from", dateTo)
          .gte("date_to", dateFrom),
        supabaseAdmin
          .from("offer_availability_blocks")
          .select("offer_id")
          .lte("date_from", dateTo)
          .gte("date_to", dateFrom),
        supabaseAdmin
          .from("bookings")
          .select("offer_id")
          .in("status", ["requested", "approved", "active"])
          .lte("date_from", dateTo)
          .gte("date_to", dateFrom),
      ]);

      for (const result of [reservationsResult, blocksResult, bookingsResult]) {
        if (result.error) throw new Error(result.error.message);
      }

      const unavailableIds = new Set<string>();
      for (const row of reservationsResult.data || []) if (row.offer_id) unavailableIds.add(row.offer_id);
      for (const row of blocksResult.data || []) if (row.offer_id) unavailableIds.add(row.offer_id);
      for (const row of bookingsResult.data || []) if (row.offer_id) unavailableIds.add(row.offer_id);
      if (unavailableIds.size) {
        query = query.not("id", "in", `(${[...unavailableIds].join(",")})`);
      }
    }

    if (search) {
      const searchTerms = buildServerSearchTerms(search);
      if (searchTerms.length) {
        const searchableColumns = ["title", "description", "category", "pickup_place"];
        const filters = searchTerms.flatMap((term) =>
          searchableColumns.map((column) => `${column}.ilike.%${term}%`),
        );
        query = query.or(filters.join(","));
      }
    }

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const sanitizedOffers = await sanitizeOfferPrimaryImages(
      supabaseAdmin,
      data || [],
    );

    const offers = await attachTodayAvailabilityServer(sanitizedOffers);
    const offersWithRequestedAvailability = dateFrom && dateTo
      ? offers.map((offer) => ({ ...offer, requested_date_available: true, requested_date_from: dateFrom, requested_date_to: dateTo }))
      : offers;

    return NextResponse.json({ offers: offersWithRequestedAvailability, count: count || 0 });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Nabídky se nepodařilo načíst"), offers: [], count: 0 },
      { status: 400 },
    );
  }
}
