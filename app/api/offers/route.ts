import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { sanitizeRichText, errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

type OfferPayload = {
  offer_type: string;
  title: string;
  description: string;
  category: string;
  condition?: string | null;
  price_amount: string;
  price_unit: string;
  price_note?: string | null;
  deposit?: string | null;
  pickup_place: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  handover_options: string[];
  contact_note?: string | null;
};

function parsePayload(formData: FormData): OfferPayload {
  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    throw new Error("Chybí data nabídky");
  }
  return JSON.parse(raw) as OfferPayload;
}

function validatePayload(payload: OfferPayload, photoCount: number) {
  const offerType = payload.offer_type === "service" ? "service" : "item";

  if (offerType === "item" && photoCount === 0) {
    throw new Error("Nahraj alespoň jednu fotku věci");
  }

  if (!payload.title?.trim() || payload.title.trim().length > 120) {
    throw new Error("Vyplň název nabídky do 120 znaků");
  }

  if (!payload.category) {
    throw new Error("Vyber kategorii");
  }

  if (offerType === "item" && !payload.condition) {
    throw new Error("Vyber stav nabídky");
  }

  if (!payload.description?.trim() || payload.description.length > 8000) {
    throw new Error("Vyplň popis nabídky");
  }

  const priceAmount = Number(payload.price_amount);
  if (!Number.isFinite(priceAmount) || priceAmount < 0) {
    throw new Error("Vyplň platnou cenu");
  }

  if (!payload.price_unit) {
    throw new Error("Vyber jednotku ceny");
  }

  if (!payload.pickup_place?.trim() || !payload.pickup_latitude || !payload.pickup_longitude) {
    throw new Error("Vyber lokalitu z našeptávače");
  }

  if (offerType === "item" && (!Array.isArray(payload.handover_options) || payload.handover_options.length === 0)) {
    throw new Error("Vyber alespoň jednu možnost předání");
  }
}

export async function POST(request: Request) {
  const rate = checkRateLimit({
    key: `offers:create:${getClientIp(request)}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const formData = await request.formData();
    const payload = parsePayload(formData);
    const photos = formData.getAll("photos").filter((value): value is File => value instanceof File);
    const mainPhotoIndexRaw = Number(formData.get("mainPhotoIndex") || 0);
    const mainPhotoIndex = Number.isInteger(mainPhotoIndexRaw) ? mainPhotoIndexRaw : 0;

    if (photos.length > 8) {
      throw new Error("Můžeš mít maximálně 8 fotek");
    }

    for (const photo of photos) {
      if (photo.size > 15 * 1024 * 1024) {
        throw new Error("Jedna z fotek je větší než 15 MB");
      }
    }

    validatePayload(payload, photos.length);

    const offerType = payload.offer_type === "service" ? "service" : "item";
    const description = sanitizeRichText(payload.description);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, city, latitude, longitude")
      .eq("id", user.id)
      .single();

    if (!profile?.full_name || !profile?.city || !profile?.latitude || !profile?.longitude) {
      throw new Error("Nejdříve dokonči svůj profil");
    }

    const { data: offer, error: offerError } = await supabaseAdmin
      .from("offers")
      .insert({
        owner_id: user.id,
        offer_type: offerType,
        title: payload.title.trim(),
        description,
        category: payload.category,
        condition: offerType === "item" ? payload.condition : null,
        price_amount: Number(payload.price_amount),
        price_unit: payload.price_unit,
        price_note: payload.price_note?.trim() || null,
        deposit: offerType === "item" && payload.deposit ? Number(payload.deposit) : null,
        pickup_place: payload.pickup_place.trim(),
        pickup_latitude: payload.pickup_latitude,
        pickup_longitude: payload.pickup_longitude,
        handover_options: offerType === "item" ? payload.handover_options : [],
        contact_note: payload.contact_note?.trim() || null,
        is_active: true,
      })
      .select("id")
      .single();

    if (offerError || !offer) {
      throw new Error(offerError?.message || "Nepodařilo se uložit nabídku");
    }

    let orderedPhotos = [...photos];
    if (orderedPhotos.length > 0) {
      const safeMainIndex = mainPhotoIndex >= 0 && mainPhotoIndex < orderedPhotos.length ? mainPhotoIndex : 0;
      const [mainPhoto] = orderedPhotos.splice(safeMainIndex, 1);
      orderedPhotos = mainPhoto ? [mainPhoto, ...orderedPhotos] : orderedPhotos;
    }

    let primaryImageUrl: string | null = null;

    for (let index = 0; index < orderedPhotos.length; index++) {
      const photo = orderedPhotos[index];
      const filePath = `${user.id}/${offer.id}/${index}-${randomUUID()}.webp`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("offers")
        .upload(filePath, photo, {
          contentType: photo.type || "image/webp",
          upsert: false,
        });

      if (uploadError) {
        await supabaseAdmin.from("offers").delete().eq("id", offer.id);
        throw new Error("Nepodařilo se nahrát fotku");
      }

      const { data: publicUrl } = supabaseAdmin.storage.from("offers").getPublicUrl(filePath);
      if (index === 0) primaryImageUrl = publicUrl.publicUrl;

      const { error: imageError } = await supabaseAdmin.from("offer_images").insert({
        offer_id: offer.id,
        image_url: publicUrl.publicUrl,
        sort_order: index,
      });

      if (imageError) {
        throw new Error(imageError.message);
      }
    }

    if (primaryImageUrl) {
      await supabaseAdmin.from("offers").update({ primary_image_url: primaryImageUrl }).eq("id", offer.id);
    }

    return NextResponse.json({ ok: true, offerId: offer.id });
  } catch (error) {
    const message = errorMessage(error, "Nabídku se nepodařilo uložit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
