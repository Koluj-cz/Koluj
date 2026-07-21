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
  customer_id: string | null;
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
        .select("id, offer_id, customer_id, status, created_at")
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

    const relevantBookings = bookings.filter((booking) => booking.status !== "cancelled");

    const topOffer = [...offerPerformance]
      .sort((a, b) => b.bookings - a.bookings || b.views - a.views)
      .find((offer) => offer.bookings > 0) || null;

    const bookingsByCustomer = new Map<string, number>();
    for (const booking of relevantBookings) {
      if (!booking.customer_id) continue;
      bookingsByCustomer.set(
        booking.customer_id,
        (bookingsByCustomer.get(booking.customer_id) || 0) + 1,
      );
    }

    const returningCustomers = Array.from(bookingsByCustomer.values()).filter(
      (bookingCount) => bookingCount > 1,
    ).length;

    const allTimeMonths = new Map<string, { label: string; count: number }>();
    const fullMonthFormatter = new Intl.DateTimeFormat("cs-CZ", {
      timeZone: "Europe/Prague",
      month: "long",
      year: "numeric",
    });

    for (const booking of relevantBookings) {
      const date = new Date(booking.created_at);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const current = allTimeMonths.get(key);
      if (current) {
        current.count += 1;
      } else {
        allTimeMonths.set(key, {
          label: fullMonthFormatter.format(date),
          count: 1,
        });
      }
    }

    const mostActiveMonth = Array.from(allTimeMonths.values())
      .sort((a, b) => b.count - a.count)[0] || null;

    type Recommendation = {
      title: string;
      text: string;
      href: string;
      actionLabel: string;
      priority: "attention" | "tip" | "good";
    };

    const recommendations: Recommendation[] = [];

    if (offers.length === 0) {
      recommendations.push({
        title: "Přidej první nabídku",
        text: "Po přidání nabídky se tu začnou zobrazovat konkrétní doporučení podle jejího výkonu.",
        href: "/offers/new",
        actionLabel: "Přidat nabídku",
        priority: "tip",
      });
    }

    const offersWithoutPhoto = offers.filter((offer) => !offer.primary_image_url);
    if (offersWithoutPhoto.length > 0) {
      const firstOffer = offersWithoutPhoto[0];
      recommendations.push({
        title: offersWithoutPhoto.length === 1 ? "Chybí hlavní fotografie" : "Některým nabídkám chybí fotografie",
        text: offersWithoutPhoto.length === 1
          ? `Nabídka „${firstOffer.title}“ zatím nemá hlavní fotografii.`
          : `Bez hlavní fotografie jsou ${offersWithoutPhoto.length} nabídky. Začni u „${firstOffer.title}“.`,
        href: `/offers/${firstOffer.id}/edit`,
        actionLabel: "Doplnit fotografii",
        priority: "attention",
      });
    }

    const highViewsLowBookings = offerPerformance.find(
      (offer) => offer.views >= 20 && offer.bookings === 0,
    );
    if (highViewsLowBookings) {
      recommendations.push({
        title: "Zájem se zatím nemění v rezervace",
        text: `„${highViewsLowBookings.title}“ má ${highViewsLowBookings.views} zobrazení, ale žádnou rezervaci. Zkus upravit cenu, popis nebo podmínky předání.`,
        href: `/offers/${highViewsLowBookings.id}/edit`,
        actionLabel: "Upravit nabídku",
        priority: "tip",
      });
    }

    const inactiveOffers = offers.filter((offer) => offer.publication_status === "inactive");
    if (inactiveOffers.length > 0) {
      recommendations.push({
        title: inactiveOffers.length === 1 ? "Jedna nabídka je skrytá" : "Některé nabídky jsou skryté",
        text: inactiveOffers.length === 1
          ? `„${inactiveOffers[0].title}“ není veřejně viditelná.`
          : `${inactiveOffers.length} nabídky nejsou veřejně viditelné.`,
        href: "/dashboard/my-offers",
        actionLabel: "Zkontrolovat nabídky",
        priority: "tip",
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentBookings = bookings.filter(
      (booking) => new Date(booking.created_at).getTime() >= thirtyDaysAgo.getTime(),
    ).length;

    if (offers.length > 0 && bookings.length > 0 && recentBookings === 0) {
      recommendations.push({
        title: "Poslední měsíc bez nové rezervace",
        text: "Zkus aktualizovat méně aktivní nabídku nebo přidat novou věc či službu.",
        href: "/dashboard/my-offers",
        actionLabel: "Projít nabídky",
        priority: "tip",
      });
    }

    if (recommendations.length === 0 && offers.length > 0) {
      recommendations.push({
        title: "Nabídky vypadají dobře",
        text: "Všechny nabídky mají fotografie a návštěvnost se proměňuje v rezervace.",
        href: "/dashboard/my-offers",
        actionLabel: "Zobrazit nabídky",
        priority: "good",
      });
    }

    return NextResponse.json({
      summary: { activeOffers, totalViews, completedBookings, successRate },
      rating: ratingResult.data || null,
      offerPerformance: offerPerformance.slice(0, 6),
      activity: activity.map(({ label, count }) => ({ label, count })),
      highlights: {
        topOffer,
        returningCustomers: {
          count: returningCustomers,
          uniqueCustomers: bookingsByCustomer.size,
        },
        mostActiveMonth,
      },
      recommendations: recommendations.slice(0, 3),
    });
  } catch (error) {
    const message = errorMessage(error, "Statistiky se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
