import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { buildServerSearchTerms } from "@/lib/services/searchService";
import { categoryLabels, serviceCategoryLabels } from "@/lib/constants";

export async function GET(request: Request) {
  const rate = await checkRateLimit({ key: `search-suggestions:${getClientIp(request)}`, limit: 180, windowMs: 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate.resetAt);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ offers: [], categories: [] });
  const offerType = url.searchParams.get("offerType") || "all";
  const category = url.searchParams.get("category") || "";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || dateFrom;
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("offers").select("id,title,offer_type,category,pickup_place,price_amount,price_unit").eq("publication_status", "active").eq("hidden_by_account_deactivation", false).limit(6);
  if (offerType !== "all") query = query.eq("offer_type", offerType);
  if (category) query = query.eq("category", category);
  if (dateFrom && dateTo) {
    const [reservations, blocks, bookings] = await Promise.all([
      supabase.from("offer_reservations").select("offer_id").eq("status", "active").lte("date_from", dateTo).gte("date_to", dateFrom),
      supabase.from("offer_availability_blocks").select("offer_id").lte("date_from", dateTo).gte("date_to", dateFrom),
      supabase.from("bookings").select("offer_id").in("status", ["requested", "approved", "active"]).lte("date_from", dateTo).gte("date_to", dateFrom),
    ]);
    const unavailable = new Set<string>();
    for (const result of [reservations, blocks, bookings]) {
      if (!result.error) for (const row of result.data || []) if (row.offer_id) unavailable.add(row.offer_id);
    }
    if (unavailable.size) query = query.not("id", "in", `(${[...unavailable].join(",")})`);
  }
  const terms = buildServerSearchTerms(q).slice(0, 8);
  if (terms.length) query = query.or(terms.flatMap((term) => ["title", "description", "category"].map((column) => `${column}.ilike.%${term}%`)).join(","));
  const { data, error } = await query;
  if (error) return NextResponse.json({ offers: [], categories: [] });
  const normalized = q.toLocaleLowerCase("cs-CZ");
  const labels = offerType === "service" ? serviceCategoryLabels : offerType === "item" ? categoryLabels : { ...categoryLabels, ...serviceCategoryLabels };
  const categories = Object.entries(labels).filter(([value, label]) => !category && (value.includes(normalized) || label.toLocaleLowerCase("cs-CZ").includes(normalized))).slice(0, 4).map(([value, label]) => ({ value, label }));
  return NextResponse.json({ offers: data || [], categories });
}
