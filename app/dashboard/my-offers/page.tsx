import { redirect } from "next/navigation";
import MyOffersClient, { type MyOffer } from "@/app/dashboard/my-offers/MyOffersClient";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function attachTodayAvailability<T extends { id: string }>(items: T[]) {
  if (items.length === 0) {
    return items.map((item) => ({ ...item, is_reserved_today: false }));
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

async function loadMyOffers() {
  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const { data, error } = await supabaseAdmin
      .from("offers")
      .select(`
        id,
        owner_id,
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
        is_active,
        deleted_at,
        bookings:bookings!bookings_offer_id_fkey (
          id,
          owner_earnings
        )
      `)
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const rawOffers = (data ?? []) as unknown as MyOffer[];
    return await attachTodayAvailability(rawOffers);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/login?redirectTo=/dashboard/my-offers");
    }

    console.error("My offers server load error:", error);
    return [];
  }
}

export default async function MyOffersPage() {
  const offers = await loadMyOffers();

  return <MyOffersClient initialOffers={offers} />;
}
