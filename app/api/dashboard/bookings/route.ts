import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

const PAGE_SIZE = 10;

const selectQuery = `
  *,
  offers:offers (
    id,
    title,
    primary_image_url,
    offer_type
  ),
  owner:profiles!bookings_owner_id_fkey (
    full_name
  ),
  customer:profiles!bookings_customer_id_fkey (
    full_name
  )
`;

export async function GET(request: Request) {
  const rate = await checkRateLimit({
    key: `dashboard-bookings:get:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const url = new URL(request.url);
    const borrowingPage = Math.max(1, Number(url.searchParams.get("borrowingPage") || 1));
    const lendingPage = Math.max(1, Number(url.searchParams.get("lendingPage") || 1));

    const [borrowingResult, lendingResult] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select(selectQuery, { count: "exact" })
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .range(0, borrowingPage * PAGE_SIZE - 1),
      supabaseAdmin
        .from("bookings")
        .select(selectQuery, { count: "exact" })
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .range(0, lendingPage * PAGE_SIZE - 1),
    ]);

    if (borrowingResult.error) throw new Error(borrowingResult.error.message);
    if (lendingResult.error) throw new Error(lendingResult.error.message);

    return NextResponse.json({
      borrowing: borrowingResult.data || [],
      lending: lendingResult.data || [],
      borrowingTotal: borrowingResult.count || 0,
      lendingTotal: lendingResult.count || 0,
    });
  } catch (error) {
    const message = errorMessage(error, "Rezervace se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json(
      { error: message, borrowing: [], lending: [], borrowingTotal: 0, lendingTotal: 0 },
      { status },
    );
  }
}
