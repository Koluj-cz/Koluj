import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { escapeHtml } from "@/lib/security";

const REPORT_RECIPIENT = process.env.MONTHLY_REPORT_RECIPIENT || "info@koluj.cz";
const REPORT_FROM = process.env.MONTHLY_REPORT_FROM || "Koluj <noreply@koluj.cz>";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://koluj.cz").replace(/\/$/, "");
const KOLUJ_GREEN = "#16a34a";
const PAGE_SIZE = 1000;

type JsonRecord = Record<string, unknown>;
type Period = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  startIso: string;
  endIso: string;
  startDate: string;
  endDateInclusive: string;
  label: string;
};

type OfferRow = {
  id: string;
  owner_id: string;
  title: string;
  category: string | null;
  pickup_place: string | null;
  offer_type: string;
  status: string | null;
  is_active: boolean | null;
  publication_status: string | null;
  primary_image_url: string | null;
  views_count: number | null;
  created_at: string;
  deleted_at: string | null;
  hidden_by_account_deactivation: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  is_verified: boolean | null;
  created_at: string;
  last_seen_at: string | null;
  deleted_at: string | null;
  is_deactivated: boolean | null;
  deactivated_at: string | null;
  is_seed_user: boolean | null;
};

type BookingRow = {
  id: string;
  offer_id: string;
  owner_id: string;
  customer_id: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  returned_at: string | null;
};

type ReviewRow = {
  id: string;
  reviewed_user_id: string;
  offer_id: string | null;
  rating: number;
  created_at: string;
};

type MessageRow = {
  id: string;
  booking_id: string;
  created_at: string;
  is_system: boolean;
};

type PreviousMetrics = {
  offerViewSnapshots?: Record<string, number>;
  summary?: Record<string, number>;
};

type RankedOffer = {
  id: string;
  title: string;
  owner: string;
  reservations: number;
  views: number;
};

type RankedProvider = {
  id: string;
  name: string;
  offers: number;
  completedReservations: number;
  averageRating: number | null;
  reviewCount: number;
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function monthPeriod(referenceDate = new Date()): Period {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const previousStart = new Date(Date.UTC(year, month - 2, 1));
  const previousEnd = start;
  const inclusiveEnd = new Date(end.getTime() - 1);

  return {
    start,
    end,
    previousStart,
    previousEnd,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDateInclusive: inclusiveEnd.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("cs-CZ", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(start),
  };
}

async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  configure?: (query: any) => any,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (configure) query = configure(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function inPeriod(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("cs-CZ").format(value);
}

function formatPercent(value: number | null) {
  if (value === null) return "nově";
  if (value === 0) return "0 %";
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(value)} %`;
}

function safe(value: unknown) {
  return escapeHtml(String(value ?? ""));
}

function activeOffer(offer: OfferRow) {
  return (
    !offer.deleted_at &&
    offer.is_active !== false &&
    offer.publication_status === "active" &&
    !offer.hidden_by_account_deactivation
  );
}

function trendBadge(value: number | null) {
  const positive = value !== null && value > 0;
  const negative = value !== null && value < 0;
  const color = positive ? "#166534" : negative ? "#b91c1c" : "#475569";
  const background = positive ? "#dcfce7" : negative ? "#fee2e2" : "#f1f5f9";
  return `<span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${background};color:${color};font-size:12px;font-weight:700;white-space:nowrap;">${safe(formatPercent(value))}</span>`;
}

function metricCard(label: string, value: string, trend?: number | null, helper?: string) {
  return `<td style="width:25%;padding:6px;vertical-align:top;">
    <div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#ffffff;min-height:92px;">
      <div style="font-size:12px;color:#64748b;margin-bottom:8px;">${safe(label)}</div>
      <div style="font-size:25px;font-weight:800;color:#0f172a;margin-bottom:8px;">${safe(value)}</div>
      ${trend !== undefined ? trendBadge(trend) : ""}
      ${helper ? `<div style="font-size:12px;color:#64748b;margin-top:7px;">${safe(helper)}</div>` : ""}
    </div>
  </td>`;
}

function tableHtml(headers: string[], rows: string[][]) {
  if (!rows.length) return `<p style="color:#64748b;margin:0;">Za toto období nejsou dostupná data.</p>`;
  return `<div style="overflow-x:auto;"><table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr>${headers.map((header) => `<th align="left" style="padding:10px 8px;border-bottom:2px solid #e2e8f0;color:#475569;">${safe(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;color:#0f172a;vertical-align:top;">${cell}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function section(title: string, body: string) {
  return `<section style="margin-top:28px;"><h2 style="font-size:19px;line-height:1.3;color:#0f172a;margin:0 0 14px;">${safe(title)}</h2>${body}</section>`;
}

function buildNarrative(input: {
  label: string;
  newUsers: number;
  newOffers: number;
  newBookings: number;
  completedBookings: number;
  active30: number;
  averageRating: number | null;
  topCategory: string | null;
  inactive180: number;
  offersWithoutBookings: number;
}) {
  const ratingText = input.averageRating === null
    ? "Bez nových hodnocení."
    : `Nová hodnocení měla průměr ${input.averageRating.toLocaleString("cs-CZ")}/5.`;
  const categoryText = input.topCategory
    ? `Nejvíce dokončených rezervací získala kategorie ${input.topCategory}.`
    : "Pro určení nejsilnější kategorie zatím nebylo dost dat.";

  return `Za období ${input.label} přibylo ${formatNumber(input.newUsers)} uživatelů a ${formatNumber(input.newOffers)} nabídek. Uživatelé vytvořili ${formatNumber(input.newBookings)} rezervací a ${formatNumber(input.completedBookings)} rezervací bylo dokončeno. Za posledních 30 dní období bylo aktivních ${formatNumber(input.active30)} uživatelů. ${ratingText} ${categoryText} Pozornost si zaslouží ${formatNumber(input.offersWithoutBookings)} nabídek bez rezervace a ${formatNumber(input.inactive180)} uživatelů neaktivních déle než 180 dní.`;
}

async function loadPreviousMetrics(supabase: SupabaseClient, period: Period) {
  const { data, error } = await supabase
    .from("admin_monthly_reports")
    .select("metrics")
    .eq("period_start", period.previousStart.toISOString().slice(0, 10))
    .eq("period_end", new Date(period.previousEnd.getTime() - 1).toISOString().slice(0, 10))
    .eq("recipient", REPORT_RECIPIENT)
    .eq("status", "sent")
    .maybeSingle();

  if (error) throw new Error(`Předchozí report: ${error.message}`);
  return (data?.metrics || null) as PreviousMetrics | null;
}

async function collectReportData(supabase: SupabaseClient, period: Period) {
  const [profiles, offers, bookings, reviews, messages, realizations, offerImages, offerVideos, realizationImages, realizationVideos, previousMetrics] = await Promise.all([
    fetchAll<ProfileRow>(supabase, "profiles", "id,full_name,city,is_verified,created_at,last_seen_at,deleted_at,is_deactivated,deactivated_at,is_seed_user"),
    fetchAll<OfferRow>(supabase, "offers", "id,owner_id,title,category,pickup_place,offer_type,status,is_active,publication_status,primary_image_url,views_count,created_at,deleted_at,hidden_by_account_deactivation"),
    fetchAll<BookingRow>(supabase, "bookings", "id,offer_id,owner_id,customer_id,status,created_at,approved_at,returned_at"),
    fetchAll<ReviewRow>(supabase, "reviews", "id,reviewed_user_id,offer_id,rating,created_at"),
    fetchAll<MessageRow>(supabase, "booking_messages", "id,booking_id,created_at,is_system"),
    fetchAll<{ offer_id: string }>(supabase, "service_realizations", "offer_id"),
    fetchAll<{ offer_id: string; moderation_status: string | null; created_at: string }>(supabase, "offer_images", "offer_id,moderation_status,created_at"),
    fetchAll<{ moderation_status: string | null; created_at: string }>(supabase, "offer_videos", "moderation_status,created_at"),
    fetchAll<{ moderation_status: string | null; created_at: string }>(supabase, "service_realization_images", "moderation_status,created_at"),
    fetchAll<{ moderation_status: string | null; created_at: string }>(supabase, "service_realization_videos", "moderation_status,created_at"),
    loadPreviousMetrics(supabase, period),
  ]);

  const realUsers = profiles.filter((profile) => !profile.is_seed_user && !profile.deleted_at);
  const currentUsers = realUsers.filter((profile) => !profile.is_deactivated);
  const newUsers = currentUsers.filter((profile) => inPeriod(profile.created_at, period.start, period.end));
  const previousNewUsers = currentUsers.filter((profile) => inPeriod(profile.created_at, period.previousStart, period.previousEnd));
  const periodEndMs = period.end.getTime();
  const activeSince = (days: number) => currentUsers.filter((profile) => {
    if (!profile.last_seen_at) return false;
    const seen = new Date(profile.last_seen_at).getTime();
    return seen < periodEndMs && seen >= periodEndMs - days * 86_400_000;
  }).length;
  const inactiveOver = (days: number) => currentUsers.filter((profile) => {
    if (!profile.last_seen_at) return true;
    return new Date(profile.last_seen_at).getTime() < periodEndMs - days * 86_400_000;
  }).length;

  const visibleOffers = offers.filter((offer) => !offer.deleted_at);
  const activeOffers = visibleOffers.filter(activeOffer);
  const newOffers = visibleOffers.filter((offer) => inPeriod(offer.created_at, period.start, period.end));
  const previousNewOffers = visibleOffers.filter((offer) => inPeriod(offer.created_at, period.previousStart, period.previousEnd));
  const monthlyBookings = bookings.filter((booking) => inPeriod(booking.created_at, period.start, period.end));
  const previousMonthlyBookings = bookings.filter((booking) => inPeriod(booking.created_at, period.previousStart, period.previousEnd));
  const completedBookings = bookings.filter((booking) => inPeriod(booking.returned_at, period.start, period.end));
  const previousCompletedBookings = bookings.filter((booking) => inPeriod(booking.returned_at, period.previousStart, period.previousEnd));
  const monthlyReviews = reviews.filter((review) => inPeriod(review.created_at, period.start, period.end));
  const previousMonthlyReviews = reviews.filter((review) => inPeriod(review.created_at, period.previousStart, period.previousEnd));
  const humanMessages = messages.filter((message) => !message.is_system && inPeriod(message.created_at, period.start, period.end));

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const offerMap = new Map(offers.map((offer) => [offer.id, offer]));
  const offerBookingCounts = new Map<string, number>();
  const completedOfferCounts = new Map<string, number>();
  const providerCompletedCounts = new Map<string, number>();

  for (const booking of bookings) {
    offerBookingCounts.set(booking.offer_id, (offerBookingCounts.get(booking.offer_id) || 0) + 1);
  }
  for (const booking of completedBookings) {
    completedOfferCounts.set(booking.offer_id, (completedOfferCounts.get(booking.offer_id) || 0) + 1);
    providerCompletedCounts.set(booking.owner_id, (providerCompletedCounts.get(booking.owner_id) || 0) + 1);
  }

  const reviewByProvider = new Map<string, number[]>();
  for (const review of reviews) {
    const values = reviewByProvider.get(review.reviewed_user_id) || [];
    values.push(review.rating);
    reviewByProvider.set(review.reviewed_user_id, values);
  }

  const offersByProvider = new Map<string, number>();
  for (const offer of activeOffers) {
    offersByProvider.set(offer.owner_id, (offersByProvider.get(offer.owner_id) || 0) + 1);
  }

  const topOffers: RankedOffer[] = Array.from(completedOfferCounts.entries())
    .map(([offerId, reservations]) => {
      const offer = offerMap.get(offerId);
      const owner = offer ? profileMap.get(offer.owner_id) : null;
      return {
        id: offerId,
        title: offer?.title || "Smazaná nabídka",
        owner: owner?.full_name || "Neznámý uživatel",
        reservations,
        views: offer?.views_count || 0,
      };
    })
    .sort((a, b) => b.reservations - a.reservations || b.views - a.views)
    .slice(0, 10);

  const providerIds = new Set([...offersByProvider.keys(), ...providerCompletedCounts.keys()]);
  const topProviders: RankedProvider[] = Array.from(providerIds)
    .map((id) => {
      const ratings = reviewByProvider.get(id) || [];
      return {
        id,
        name: profileMap.get(id)?.full_name || "Neznámý uživatel",
        offers: offersByProvider.get(id) || 0,
        completedReservations: providerCompletedCounts.get(id) || 0,
        averageRating: average(ratings),
        reviewCount: ratings.length,
      };
    })
    .filter((provider) => provider.completedReservations > 0 || provider.offers > 0)
    .sort((a, b) => b.completedReservations - a.completedReservations || b.offers - a.offers)
    .slice(0, 10);

  const currentViewSnapshots = Object.fromEntries(visibleOffers.map((offer) => [offer.id, offer.views_count || 0]));
  const previousViewSnapshots = previousMetrics?.offerViewSnapshots || null;
  const allOfferViews = visibleOffers.map((offer) => ({
    id: offer.id,
    title: offer.title,
    owner: profileMap.get(offer.owner_id)?.full_name || "Neznámý uživatel",
    views: previousViewSnapshots
      ? Math.max(0, (offer.views_count || 0) - (previousViewSnapshots[offer.id] || 0))
      : offer.views_count || 0,
  }));
  const monthlyOfferViews = [...allOfferViews]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  const viewsAreMonthly = Boolean(previousViewSnapshots);
  const totalViews = allOfferViews.reduce((sum, offer) => sum + offer.views, 0);

  const categoryReservations = new Map<string, number>();
  for (const booking of completedBookings) {
    const category = offerMap.get(booking.offer_id)?.category?.trim() || "Bez kategorie";
    categoryReservations.set(category, (categoryReservations.get(category) || 0) + 1);
  }
  const topCategories = Array.from(categoryReservations.entries())
    .map(([category, reservations]) => ({ category, reservations }))
    .sort((a, b) => b.reservations - a.reservations)
    .slice(0, 8);

  const cityUsers = new Map<string, number>();
  for (const profile of currentUsers) {
    const city = profile.city?.trim();
    if (city) cityUsers.set(city, (cityUsers.get(city) || 0) + 1);
  }
  const topCities = Array.from(cityUsers.entries())
    .map(([city, users]) => ({ city, users }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 8);

  const imageOfferIds = new Set(offerImages.map((image) => image.offer_id));
  const realizationOfferIds = new Set(realizations.map((realization) => realization.offer_id));
  const offersWithoutImage = activeOffers.filter((offer) => !offer.primary_image_url && !imageOfferIds.has(offer.id)).length;
  const offersWithoutBookings = activeOffers.filter((offer) => !offerBookingCounts.has(offer.id)).length;
  const offersWithoutViews = activeOffers.filter((offer) => (offer.views_count || 0) === 0).length;
  const servicesWithoutRealization = activeOffers.filter((offer) => offer.offer_type === "service" && !realizationOfferIds.has(offer.id)).length;
  const usersWithoutOffer = currentUsers.filter((profile) => !visibleOffers.some((offer) => offer.owner_id === profile.id)).length;

  const allModeratedMedia = [...offerImages, ...offerVideos, ...realizationImages, ...realizationVideos];
  const monthlyModeratedMedia = allModeratedMedia.filter((media) => inPeriod(media.created_at, period.start, period.end));
  const moderationCounts = (rows: typeof allModeratedMedia) => ({
    total: rows.length,
    approved: rows.filter((row) => row.moderation_status === "approved").length,
    review: rows.filter((row) => row.moderation_status === "review").length,
    rejected: rows.filter((row) => row.moderation_status === "rejected").length,
    failed: rows.filter((row) => row.moderation_status === "failed").length,
    pending: rows.filter((row) => row.moderation_status === "pending" || row.moderation_status === "processing").length,
  });

  const summary = {
    totalUsers: currentUsers.length,
    newUsers: newUsers.length,
    active7: activeSince(7),
    active30: activeSince(30),
    totalActiveOffers: activeOffers.length,
    newOffers: newOffers.length,
    newBookings: monthlyBookings.length,
    completedBookings: completedBookings.length,
    newReviews: monthlyReviews.length,
  };

  const metrics = {
    period: { start: period.startDate, end: period.endDateInclusive, label: period.label },
    summary,
    trends: {
      newUsers: percentChange(newUsers.length, previousNewUsers.length),
      newOffers: percentChange(newOffers.length, previousNewOffers.length),
      newBookings: percentChange(monthlyBookings.length, previousMonthlyBookings.length),
      completedBookings: percentChange(completedBookings.length, previousCompletedBookings.length),
      newReviews: percentChange(monthlyReviews.length, previousMonthlyReviews.length),
    },
    users: {
      total: currentUsers.length,
      new: newUsers.length,
      activeToday: activeSince(1),
      active7: activeSince(7),
      active30: activeSince(30),
      inactive90: inactiveOver(90),
      inactive180: inactiveOver(180),
      verified: currentUsers.filter((profile) => profile.is_verified).length,
      deactivated: realUsers.filter((profile) => profile.is_deactivated).length,
      neverSeen: currentUsers.filter((profile) => !profile.last_seen_at).length,
      withoutOffer: usersWithoutOffer,
    },
    offers: {
      total: visibleOffers.length,
      active: activeOffers.length,
      new: newOffers.length,
      newItems: newOffers.filter((offer) => offer.offer_type === "item").length,
      newServices: newOffers.filter((offer) => offer.offer_type === "service").length,
      archived: visibleOffers.filter((offer) => offer.publication_status === "archived").length,
      inactive: visibleOffers.filter((offer) => offer.publication_status === "inactive").length,
      withoutImage: offersWithoutImage,
      withoutBookings: offersWithoutBookings,
      withoutViews: offersWithoutViews,
      servicesWithoutRealization,
    },
    bookings: {
      created: monthlyBookings.length,
      requested: monthlyBookings.filter((booking) => booking.status === "requested").length,
      approved: monthlyBookings.filter((booking) => booking.status === "approved").length,
      active: monthlyBookings.filter((booking) => booking.status === "active").length,
      returned: completedBookings.length,
      cancelled: monthlyBookings.filter((booking) => booking.status === "cancelled").length,
      completionRate: monthlyBookings.length
        ? Math.round((monthlyBookings.filter((booking) => booking.status === "returned").length / monthlyBookings.length) * 1000) / 10
        : 0,
    },
    reviews: {
      new: monthlyReviews.length,
      average: average(monthlyReviews.map((review) => review.rating)),
      allTimeAverage: average(reviews.map((review) => review.rating)),
    },
    moderation: {
      current: moderationCounts(allModeratedMedia),
      monthly: moderationCounts(monthlyModeratedMedia),
    },
    communication: {
      messages: humanMessages.length,
      conversations: new Set(humanMessages.map((message) => message.booking_id)).size,
      averageMessagesPerConversation: average(
        Array.from(new Set(humanMessages.map((message) => message.booking_id))).map(
          (bookingId) => humanMessages.filter((message) => message.booking_id === bookingId).length,
        ),
      ),
    },
    traffic: {
      viewsAreMonthly,
      totalViews,
      topOffers: monthlyOfferViews,
    },
    topOffers,
    topProviders,
    topCategories,
    topCities,
    attention: {
      usersWithoutOffer,
      offersWithoutImage,
      offersWithoutBookings,
      offersWithoutViews,
      servicesWithoutRealization,
      inactive180: inactiveOver(180),
    },
    offerViewSnapshots: currentViewSnapshots,
  };

  const narrative = buildNarrative({
    label: period.label,
    newUsers: newUsers.length,
    newOffers: newOffers.length,
    newBookings: monthlyBookings.length,
    completedBookings: completedBookings.length,
    active30: activeSince(30),
    averageRating: metrics.reviews.average,
    topCategory: topCategories[0]?.category || null,
    inactive180: inactiveOver(180),
    offersWithoutBookings,
  });

  return { metrics, narrative };
}

function buildEmailHtml(period: Period, metrics: any, narrative: string) {
  const topOfferRows = metrics.topOffers.map((offer: RankedOffer, index: number) => [
    `<strong>${index + 1}. ${safe(offer.title)}</strong>`,
    safe(offer.owner),
    `<strong>${formatNumber(offer.reservations)}</strong>`,
    formatNumber(offer.views),
  ]);
  const topProviderRows = metrics.topProviders.map((provider: RankedProvider, index: number) => [
    `<strong>${index + 1}. ${safe(provider.name)}</strong>`,
    formatNumber(provider.offers),
    `<strong>${formatNumber(provider.completedReservations)}</strong>`,
    provider.averageRating === null ? "—" : `${provider.averageRating.toLocaleString("cs-CZ")}/5 (${provider.reviewCount})`,
  ]);
  const trafficRows = metrics.traffic.topOffers.map((offer: any, index: number) => [
    `<strong>${index + 1}. ${safe(offer.title)}</strong>`,
    safe(offer.owner),
    `<strong>${formatNumber(offer.views)}</strong>`,
  ]);
  const categoryRows = metrics.topCategories.map((row: any) => [safe(row.category), `<strong>${formatNumber(row.reservations)}</strong>`]);
  const cityRows = metrics.topCities.map((row: any) => [safe(row.city), `<strong>${formatNumber(row.users)}</strong>`]);

  const attentionItems = [
    `${formatNumber(metrics.attention.usersWithoutOffer)} uživatelů zatím nevytvořilo nabídku.`,
    `${formatNumber(metrics.attention.offersWithoutImage)} aktivních nabídek nemá fotografii.`,
    `${formatNumber(metrics.attention.offersWithoutBookings)} aktivních nabídek dosud nemá rezervaci.`,
    `${formatNumber(metrics.attention.offersWithoutViews)} aktivních nabídek nemá žádné zobrazení.`,
    `${formatNumber(metrics.attention.servicesWithoutRealization)} aktivních služeb nemá realizaci.`,
    `${formatNumber(metrics.attention.inactive180)} uživatelů nebylo online déle než 180 dní nebo se ještě nevrátilo.`,
  ];

  return `<!doctype html>
<html lang="cs"><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;">Manažerský přehled Koluj.cz za ${safe(period.label)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="padding:28px;background:${KOLUJ_GREEN};color:#ffffff;">
        <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">Koluj.cz</div>
        <h1 style="font-size:28px;line-height:1.2;margin:8px 0 6px;">Měsíční manažerský report</h1>
        <div style="font-size:16px;opacity:.95;">${safe(period.label)} · ${safe(period.startDate)} až ${safe(period.endDateInclusive)}</div>
      </td></tr>
      <tr><td style="padding:24px;">
        <div style="padding:16px 18px;border-radius:14px;background:#f0fdf4;border:1px solid #bbf7d0;line-height:1.65;color:#14532d;">${safe(narrative)}</div>

        ${section("Přehled platformy", `<table role="presentation" width="100%" style="border-collapse:collapse;"><tr>
          ${metricCard("Uživatelé celkem", formatNumber(metrics.users.total))}
          ${metricCard("Noví uživatelé", formatNumber(metrics.users.new), metrics.trends.newUsers)}
          ${metricCard("Aktivní nabídky", formatNumber(metrics.offers.active))}
          ${metricCard("Nové nabídky", formatNumber(metrics.offers.new), metrics.trends.newOffers)}
        </tr><tr>
          ${metricCard("Nové rezervace", formatNumber(metrics.bookings.created), metrics.trends.newBookings)}
          ${metricCard("Dokončené rezervace", formatNumber(metrics.bookings.returned), metrics.trends.completedBookings)}
          ${metricCard("Nová hodnocení", formatNumber(metrics.reviews.new), metrics.trends.newReviews)}
          ${metricCard("Průměr hodnocení", metrics.reviews.average === null ? "—" : `${metrics.reviews.average.toLocaleString("cs-CZ")}/5`)}
        </tr></table>`)}

        ${section("Aktivita uživatelů", `<table role="presentation" width="100%" style="border-collapse:collapse;"><tr>
          ${metricCard("Aktivní poslední den", formatNumber(metrics.users.activeToday))}
          ${metricCard("Aktivní 7 dní", formatNumber(metrics.users.active7))}
          ${metricCard("Aktivní 30 dní", formatNumber(metrics.users.active30))}
          ${metricCard("Neaktivní 180+ dní", formatNumber(metrics.users.inactive180))}
        </tr><tr>
          ${metricCard("Ověření uživatelé", formatNumber(metrics.users.verified))}
          ${metricCard("Deaktivované účty", formatNumber(metrics.users.deactivated))}
          ${metricCard("Bez zaznamenané aktivity", formatNumber(metrics.users.neverSeen))}
          ${metricCard("Bez vlastní nabídky", formatNumber(metrics.users.withoutOffer))}
        </tr></table>`)}

        ${section("Nabídky", `<table role="presentation" width="100%" style="border-collapse:collapse;"><tr>
          ${metricCard("Nové věci", formatNumber(metrics.offers.newItems))}
          ${metricCard("Nové služby", formatNumber(metrics.offers.newServices))}
          ${metricCard("Archivované", formatNumber(metrics.offers.archived))}
          ${metricCard("Neaktivní", formatNumber(metrics.offers.inactive))}
        </tr></table>`)}

        ${section("Rezervace", `<table role="presentation" width="100%" style="border-collapse:collapse;"><tr>
          ${metricCard("Čekající", formatNumber(metrics.bookings.requested))}
          ${metricCard("Schválené", formatNumber(metrics.bookings.approved))}
          ${metricCard("Probíhající", formatNumber(metrics.bookings.active))}
          ${metricCard("Zrušené", formatNumber(metrics.bookings.cancelled))}
        </tr></table><p style="font-size:13px;color:#64748b;margin:10px 0 0;">Podíl rezervací vytvořených v období, které už jsou dokončené: <strong>${safe(`${metrics.bookings.completionRate.toLocaleString("cs-CZ")}%`)}</strong>. Jde o orientační ukazatel, protože některé rezervace vytvořené na konci měsíce skončí až později.</p>`)}

        ${section("Nejúspěšnější nabídky", tableHtml(["Nabídka", "Vlastník", "Dokončené rezervace", "Zobrazení celkem"], topOfferRows))}
        ${section("Nejaktivnější poskytovatelé", tableHtml(["Poskytovatel", "Aktivní nabídky", "Dokončené rezervace", "Hodnocení"], topProviderRows))}
        ${section(metrics.traffic.viewsAreMonthly ? "Návštěvnost nabídek za měsíc" : "Návštěvnost nabídek – aktuální stav", `${!metrics.traffic.viewsAreMonthly ? `<p style="font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;">Toto je první uložený report, proto jsou uvedena kumulativní zobrazení. Od dalšího měsíce se návštěvnost vypočítá jako rozdíl měsíčních snapshotů.</p>` : ""}${tableHtml(["Nabídka", "Vlastník", "Zobrazení"], trafficRows)}`)}
        ${section("Kategorie s nejvíce dokončenými rezervacemi", tableHtml(["Kategorie", "Rezervace"], categoryRows))}
        ${section("Nejpočetnější lokality uživatelů", tableHtml(["Město", "Uživatelé"], cityRows))}

        ${section("Moderace médií", `<table role="presentation" width="100%" style="border-collapse:collapse;"><tr>
          ${metricCard("Nová média", formatNumber(metrics.moderation.monthly.total))}
          ${metricCard("Schválená", formatNumber(metrics.moderation.monthly.approved))}
          ${metricCard("Ke kontrole", formatNumber(metrics.moderation.current.review))}
          ${metricCard("Zamítnutá", formatNumber(metrics.moderation.monthly.rejected))}
        </tr><tr>
          ${metricCard("Chyby kontroly", formatNumber(metrics.moderation.current.failed))}
          ${metricCard("Čekající", formatNumber(metrics.moderation.current.pending))}
        </tr></table>`)}

        ${section("Komunikace", `<table role="presentation" width="100%" style="border-collapse:collapse;"><tr>
          ${metricCard("Zprávy", formatNumber(metrics.communication.messages))}
          ${metricCard("Aktivní konverzace", formatNumber(metrics.communication.conversations))}
          ${metricCard("Zpráv na konverzaci", metrics.communication.averageMessagesPerConversation === null ? "—" : metrics.communication.averageMessagesPerConversation.toLocaleString("cs-CZ"))}
          ${metricCard("Hodnocení platformy", metrics.reviews.allTimeAverage === null ? "—" : `${metrics.reviews.allTimeAverage.toLocaleString("cs-CZ")}/5`)}
        </tr></table>`)}

        ${section("Vyžaduje pozornost", `<ul style="margin:0;padding-left:22px;line-height:1.8;color:#334155;">${attentionItems.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>`)}

        <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.6;">
          Report byl vytvořen automaticky z databáze Koluj.cz. Zobrazení nabídek vycházejí ze sloupce <code>offers.views_count</code>. Celkovou návštěvnost webu z Vercel Analytics tento report přímo nečte, protože Vercel Analytics neposkytuje používanému projektu automaticky dostupná reportovací data přes současnou databázi.
          <br><a href="${safe(APP_URL)}" style="color:${KOLUJ_GREEN};">Otevřít Koluj.cz</a>
        </div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendMonthlyManagementReport(options?: { force?: boolean; referenceDate?: Date }) {
  const supabase = adminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const period = monthPeriod(options?.referenceDate);
  const subject = `Koluj.cz – manažerský report za ${period.label}`;

  const { data: existing, error: existingError } = await supabase
    .from("admin_monthly_reports")
    .select("id,status,sent_at")
    .eq("period_start", period.startDate)
    .eq("period_end", period.endDateInclusive)
    .eq("recipient", REPORT_RECIPIENT)
    .maybeSingle();

  if (existingError) throw new Error(`Kontrola reportu: ${existingError.message}`);
  if (existing?.status === "sent" && !options?.force) {
    return { ok: true, skipped: true, reason: "already_sent", reportId: existing.id, period: period.label };
  }

  let reportId = existing?.id as string | undefined;

  if (reportId) {
    const { error } = await supabase.from("admin_monthly_reports").update({
      status: "processing",
      subject,
      error_message: null,
    }).eq("id", reportId);
    if (error) throw new Error(`Aktualizace reportu: ${error.message}`);
  } else {
    const { data, error } = await supabase.from("admin_monthly_reports").insert({
      period_start: period.startDate,
      period_end: period.endDateInclusive,
      recipient: REPORT_RECIPIENT,
      subject,
      status: "processing",
    }).select("id").single();
    if (error) throw new Error(`Vytvoření reportu: ${error.message}`);
    reportId = data.id;
  }

  try {
    const { metrics, narrative } = await collectReportData(supabase, period);
    const html = buildEmailHtml(period, metrics, narrative);

    const { data, error } = await resend.emails.send({
      from: REPORT_FROM,
      to: REPORT_RECIPIENT,
      subject,
      html,
    });

    if (error) throw new Error(error.message);

    const { error: updateError } = await supabase.from("admin_monthly_reports").update({
      status: "sent",
      metrics: metrics as unknown as JsonRecord,
      html,
      resend_email_id: data?.id || null,
      error_message: null,
      sent_at: new Date().toISOString(),
    }).eq("id", reportId);

    if (updateError) throw new Error(`Uložení výsledku reportu: ${updateError.message}`);

    return {
      ok: true,
      skipped: false,
      reportId,
      period: period.label,
      recipient: REPORT_RECIPIENT,
      resendEmailId: data?.id || null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neznámá chyba";
    await supabase.from("admin_monthly_reports").update({
      status: "failed",
      error_message: message,
    }).eq("id", reportId);
    throw error;
  }
}
