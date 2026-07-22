import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { errorMessage } from "@/lib/security";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";

const MAX_REALIZATIONS = 12;
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: offerId } = await params;
  const rate = await checkRateLimit({
    key: `offer-realizations:create:${offerId}:${getClientIp(request)}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const rawPrice = String(formData.get("indicativePriceFrom") || "").trim();
    const sortOrder = Number(formData.get("sortOrder") || 0);
    const images = formData
      .getAll("images")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (!title || title.length > 120) throw new Error("Vyplň název realizace do 120 znaků");
    if (description.length > 1000) throw new Error("Popis realizace může mít maximálně 1000 znaků");
    if (images.length === 0) throw new Error("Přidej alespoň jednu fotografii realizace");
    if (images.length > MAX_IMAGES) throw new Error(`Jedna realizace může mít maximálně ${MAX_IMAGES} fotek`);

    const price = rawPrice === "" ? null : Number(rawPrice);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      throw new Error("Vyplň platnou orientační cenu");
    }

    for (const image of images) {
      if (!image.type.startsWith("image/")) throw new Error("Realizace může obsahovat pouze fotografie");
      if (image.size > MAX_IMAGE_SIZE) throw new Error("Jedna fotografie realizace může mít maximálně 10 MB");
    }

    const { data: offer, error: offerError } = await supabaseAdmin
      .from("offers")
      .select("id, owner_id, offer_type")
      .eq("id", offerId)
      .maybeSingle();
    if (offerError || !offer) throw new Error("Nabídka nebyla nalezena");
    if (offer.owner_id !== user.id) throw new Error("Realizace může upravovat pouze vlastník nabídky");
    if (offer.offer_type !== "service") throw new Error("Realizace lze přidat pouze ke službě");

    const { count } = await supabaseAdmin
      .from("service_realizations")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", offerId);
    if ((count || 0) >= MAX_REALIZATIONS) {
      throw new Error(`Ke službě lze přidat maximálně ${MAX_REALIZATIONS} realizací`);
    }

    const { data: realization, error: realizationError } = await supabaseAdmin
      .from("service_realizations")
      .insert({
        offer_id: offerId,
        title,
        description: description || null,
        indicative_price_from: price,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : count || 0,
      })
      .select("id")
      .single();
    if (realizationError || !realization) {
      throw new Error(realizationError?.message || "Realizaci se nepodařilo uložit");
    }

    const uploadedPaths: string[] = [];
    try {
      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
        const path = `${user.id}/${offerId}/realizations/${realization.id}/${index}-${randomUUID()}.${extension}`;
        const { error: uploadError } = await supabaseAdmin.storage.from("offers").upload(path, image, {
          contentType: image.type,
          upsert: false,
        });
        if (uploadError) throw new Error("Fotografii realizace se nepodařilo nahrát");
        uploadedPaths.push(path);
        const { data: publicUrl } = supabaseAdmin.storage.from("offers").getPublicUrl(path);
        const { error: imageError } = await supabaseAdmin.from("service_realization_images").insert({
          realization_id: realization.id,
          image_url: publicUrl.publicUrl,
          sort_order: index,
        });
        if (imageError) throw new Error(imageError.message);
      }
    } catch (error) {
      if (uploadedPaths.length > 0) await supabaseAdmin.storage.from("offers").remove(uploadedPaths);
      await supabaseAdmin.from("service_realizations").delete().eq("id", realization.id);
      throw error;
    }

    return NextResponse.json({ ok: true, realizationId: realization.id });
  } catch (error) {
    const message = errorMessage(error, "Realizaci se nepodařilo uložit");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
