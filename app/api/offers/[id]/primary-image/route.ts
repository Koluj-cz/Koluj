import { NextResponse } from "next/server";
import { requireUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rate = await checkRateLimit({
    key: `offer-primary-image:update:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  const { id } = await params;

  try {
    const { user } = await requireUser();
    const { imageUrl } = await request.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      throw new Error("Chybí adresa fotky");
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const { data: offer, error: offerError } = await supabaseAdmin
      .from("offers")
      .select("id, owner_id")
      .eq("id", id)
      .single();

    if (offerError || !offer) throw new Error("Nabídka nebyla nalezena");
    if (offer.owner_id !== user.id) throw new Error("Hlavní fotku může změnit pouze vlastník nabídky");

    const { data: image, error: imageError } = await supabaseAdmin
      .from("offer_images")
      .select("id")
      .eq("offer_id", id)
      .eq("image_url", imageUrl)
      .single();

    if (imageError || !image) throw new Error("Fotka nebyla nalezena");

    const { error } = await supabaseAdmin.from("offers").update({ primary_image_url: imageUrl }).eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, primaryImageUrl: imageUrl });
  } catch (error) {
    const message = errorMessage(error, "Hlavní fotku se nepodařilo nastavit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
