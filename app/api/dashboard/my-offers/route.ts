import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { attachTodayAvailabilityServer } from "@/lib/services/offerAvailabilityStatusService";
import { normalizeEditablePublicationStatus } from "@/lib/offerPublication";

export async function GET(request: Request) {
  const rate = await checkRateLimit({
    key: `dashboard-my-offers:get:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const { data, error } = await supabaseAdmin
      .from("offers")
      .select(`
        *,
        bookings:bookings!bookings_offer_id_fkey (
          id,
          owner_earnings
        )
      `)
      .eq("owner_id", user.id)
      .neq("publication_status", "archived")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const offers = await attachTodayAvailabilityServer(data || []);
    return NextResponse.json({ offers });
  } catch (error) {
    const message = errorMessage(error, "Nabídky se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message, offers: [] }, { status });
  }
}

export async function PATCH(request: Request) {
  const rate = await checkRateLimit({
    key: `dashboard-my-offers:patch:${getClientIp(request)}`,
    limit: 80,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const { offerId, publicationStatus } = await request.json();

    if (!offerId || !["active", "inactive"].includes(publicationStatus)) {
      throw new Error("Chybí data nabídky");
    }

    const nextStatus = normalizeEditablePublicationStatus(publicationStatus);

    const { data, error } = await supabaseAdmin
      .from("offers")
      .update({ publication_status: nextStatus })
      .eq("id", offerId)
      .eq("owner_id", user.id)
      .neq("publication_status", "archived")
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Nabídka nebyla nalezena");

    return NextResponse.json({ ok: true, publicationStatus: nextStatus });
  } catch (error) {
    const message = errorMessage(error, "Nabídku se nepodařilo upravit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
