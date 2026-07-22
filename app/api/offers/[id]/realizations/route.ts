import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { errorMessage } from "@/lib/security";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";

const MAX_REALIZATIONS = 12;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: offerId } = await params;
  const rate = await checkRateLimit({ key: `offer-realizations:create:${offerId}:${getClientIp(request)}`, limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const body = await request.json();
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim();
    const rawPrice = String(body?.indicativePriceFrom || "").trim();
    const sortOrder = Number(body?.sortOrder || 0);

    if (!title || title.length > 120) throw new Error("Vyplň název realizace do 120 znaků");
    if (description.length > 1000) throw new Error("Popis realizace může mít maximálně 1000 znaků");
    const price = rawPrice === "" ? null : Number(rawPrice);
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error("Vyplň platnou orientační cenu");

    const { data: offer, error: offerError } = await supabaseAdmin.from("offers").select("id, owner_id, offer_type, publication_status").eq("id", offerId).maybeSingle();
    if (offerError || !offer) throw new Error("Nabídka nebyla nalezena");
    if (offer.owner_id !== user.id) throw new Error("Realizace může upravovat pouze vlastník nabídky");
    if (offer.offer_type !== "service") throw new Error("Realizace lze přidat pouze ke službě");
    if (offer.publication_status === "archived") throw new Error("Archivovanou nabídku nelze upravit");

    const { count } = await supabaseAdmin.from("service_realizations").select("id", { count: "exact", head: true }).eq("offer_id", offerId);
    if ((count || 0) >= MAX_REALIZATIONS) throw new Error(`Ke službě lze přidat maximálně ${MAX_REALIZATIONS} realizací`);

    const { data: realization, error } = await supabaseAdmin.from("service_realizations").insert({
      offer_id: offerId,
      title,
      description: description || null,
      indicative_price_from: price,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : count || 0,
    }).select("id").single();
    if (error || !realization) throw new Error(error?.message || "Realizaci se nepodařilo vytvořit");

    return NextResponse.json({ ok: true, realizationId: realization.id });
  } catch (error) {
    const message = errorMessage(error, "Realizaci se nepodařilo vytvořit");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
