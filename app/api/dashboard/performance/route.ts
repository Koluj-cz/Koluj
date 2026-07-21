import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

type OfferRow = {
  id: string;
  title: string;
  views_count: number | null;
  primary_image_url: string | null;
  publication_status: string | null;
  created_at: string;
};

type BookingRow = {
  id: string;
  offer_id: string;
  status: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const rate = await checkRateLimit({
    key: `dashboard-performance:get:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const [offersResult, bookingsResult, ratingResult] = await Promise.all([
      supabaseAdmin
        .from("offers")
        .select("id, title, views_count, primary_image_url, publication_status, created_at")
        .eq("owner_id", user.id)
        .neq("publication_status", "archived")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("bookings")
        .select("id, offer_id, status, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("profile_ratings")
        .select("rating_avg, rating_count")
        .eq("profile_id", user.id)
        .maybeSingle(),
    ]);

    if (offersResult.error) throw new Error(offersResult.error.message);
    if (bookingsResult.error) throw new Error(bookingsResult.error.message);

    const offers = (offersResult.data || []) as OfferRow[];
    const bookings = (bookingsResult.data || []) as BookingRow[];
    const bookingsByOffer = new Map<string, BookingRow[]>();

    for (const booking of bookings) {
      const current = bookingsByOffer.get(booking.offer_id) || [];
      current.push(booking);
      bookingsByOffer.set(booking.offer_id, current);
    }

    const offerPerformance = offers
      .map((offer) => {
        const offerBookings = bookingsByOffer.get(offer.id) || [];
        const views = Number(offer.views_count || 0);
        const bookingCount = offerBookings.length;

        return {
          id: offer.id,
          title: offer.title,
          primaryImageUrl: offer.primary_image_url,
          publicationStatus: offer.publication_status,
          views,
          bookings: bookingCount,
          conversion: views > 0 ? Math.round((bookingCount / views) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.views - a.views || b.bookings - a.bookings);

    const monthFormatter = new Intl.DateTimeFormat("cs-CZ", {
      timeZone: "Europe/Prague",
      month: "short",
    });
    const now = new Date();
    const activity = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      return { key, label: monthFormatter.format(date), count: 0 };
    });

    for (const booking of bookings) {
      const date = new Date(booking.created_at);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const month = activity.find((item) => item.key === key);
      if (month) month.count += 1;
    }

    const activeOffers = offers.filter((offer) => offer.publication_status === "active").length;
    const totalViews = offerPerformance.reduce((sum, offer) => sum + offer.views, 0);
    const completedBookings = bookings.filter((booking) => booking.status === "returned").length;
    const cancelledBookings = bookings.filter((booking) => booking.status === "cancelled").length;
    const successfulBookings = bookings.length - cancelledBookings;
    const successRate = bookings.length > 0
      ? Math.round((successfulBookings / bookings.length) * 100)
      : 0;

    const recommendations: { title: string; text: string; href: string }[] = [];
    const noPhoto = offers.find((offer) => !offer.primary_image_url);
    if (noPhoto) {
      recommendations.push({
        title: "Doplň hlavní fotografii",
        text: `Nabídka „${noPhoto.title}“ zatím nemá hlavní fotografii.`,
        href: `/offers/${noPhoto.id}/edit`,
      });
    }

    const highViewsLowBookings = offerPerformance.find(
      (offer) => offer.views >= 20 && offer.bookings === 0,
    );
    if (highViewsLowBookings) {
      recommendations.push({
        title: "Zájem bez rezervace",
        text: `„${highViewsLowBookings.title}“ má ${highViewsLowBookings.views} zobrazení, ale zatím žádnou rezervaci. Zkus upravit cenu nebo popis.`,
        href: `/offers/${highViewsLowBookings.id}/edit`,
      });
    }

    const inactiveOffer = offers.find((offer) => offer.publication_status === "inactive");
    if (inactiveOffer) {
      recommendations.push({
        title: "Skrytá nabídka",
        text: `„${inactiveOffer.title}“ není veřejně viditelná.`,
        href: "/dashboard/my-offers",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        title: "Nabídky vypadají dobře",
        text: "Máš doplněné fotografie a návštěvnost se proměňuje v rezervace.",
        href: "/dashboard/my-offers",
      });
    }

    return NextResponse.json({
      summary: { activeOffers, totalViews, completedBookings, successRate },
      rating: ratingResult.data || null,
      offerPerformance: offerPerformance.slice(0, 6),
      activity: activity.map(({ label, count }) => ({ label, count })),
      recommendations: recommendations.slice(0, 3),
    });
  } catch (error) {
    const message = errorMessage(error, "Statistiky se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
