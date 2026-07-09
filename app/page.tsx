import HomePageClient from "@/app/HomePageClient";
import type { OfferCardOffer } from "@/app/components/OfferCard";
import {
  createRequestSupabaseClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";

const ITEMS_PER_PAGE = 10;

export const dynamic = "force-dynamic";

async function attachTodayAvailability(items: OfferCardOffer[]) {
  if (items.length === 0) {
    return items;
  }

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

  return items.map((item) => ({
    ...item,
    is_reserved_today: reservedIds.has(item.id),
  }));
}

async function loadInitialOffers() {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data, count, error } = await supabaseAdmin
    .from("offers")
    .select(
      `
      id,
      title,
      description,
      offer_type,
      category,
      condition,
      pickup_place,
      pickup_latitude,
      pickup_longitude,
      price_amount,
      price_unit,
      primary_image_url,
      created_at,
      status,
      owner_id,
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
    .range(0, ITEMS_PER_PAGE - 1);

  if (error) {
    console.error("Initial offers load error:", error);
    return { offers: [], count: 0 };
  }

  const rawOffers = (data ?? []) as unknown as OfferCardOffer[];

  const offers = await attachTodayAvailability(rawOffers);

  return {
    offers,
    count: count ?? 0,
  };
}

async function getInitialAuthState() {
  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return Boolean(user);
}

export default async function HomePage() {
  const [{ offers, count }, initialIsLoggedIn] = await Promise.all([
    loadInitialOffers(),
    getInitialAuthState(),
  ]);

  return (
    <HomePageClient
      initialOffers={offers}
      initialCount={count}
      initialIsLoggedIn={initialIsLoggedIn}
    />
  );
}
