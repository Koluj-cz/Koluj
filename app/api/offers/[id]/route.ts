import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { sanitizeRichText, errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { attachTodayAvailabilityServer } from "@/lib/services/offerAvailabilityStatusService";

type UpdatePayload = {
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
  service_booking_mode?: "scheduled" | "deadline";
  service_hours_mode?: "same_every_day" | "weekday_weekend";
  weekday_start_time?: string | null;
  weekday_end_time?: string | null;
  weekend_start_time?: string | null;
  weekend_end_time?: string | null;
  is_active?: boolean;
};

function storagePathFromPublicUrl(url: string | null) {
  const marker = "/storage/v1/object/public/offers/";
  if (!url || !url.includes(marker)) return null;
  return url.split(marker)[1] || null;
}


export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { user } = await requireUser().catch(() => ({ user: null as any }));

    const { data, error } = await supabaseAdmin
      .from("offers")
      .select(
        `
        id,
        owner_id,
        title,
        description,
        category,
        pickup_place,
        deposit,
        status,
        is_active,
        views_count,
        contact_note,
        created_at,
        pickup_latitude,
        pickup_longitude,
        handover_options,
        condition,
        primary_image_url,
        price_amount,
        price_unit,
        price_note,
        is_seed_item,
        deleted_at,
        offer_type,
        service_duration_minutes,
        service_location_type,
        service_booking_mode,
        service_hours_mode,
        weekday_start_time,
        weekday_end_time,
        weekend_start_time,
        weekend_end_time,
        profiles:profiles!offers_owner_id_fkey (
          full_name,
          avatar_url,
          is_verified,
          is_seed_user,
          profile_ratings (
            rating_avg,
            rating_count
          )
        )
      `,
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      throw new Error("Nabídka nebyla nalezena");
    }

    if (data.is_active !== true && data.owner_id !== user?.id) {
      throw new Error("Nabídka není dostupná");
    }

    await supabaseAdmin.rpc("increment_offer_views", {
      offer_id_input: id,
    });

    const { data: imageData, error: imageError } = await supabaseAdmin
      .from("offer_images")
      .select("id, offer_id, image_url, sort_order, created_at")
      .eq("offer_id", id)
      .order("sort_order", { ascending: true });

    if (imageError) throw new Error(imageError.message);

    const today = new Date().toISOString().split("T")[0];

    const { data: blocksData, error: blocksError } = await supabaseAdmin
      .from("offer_availability_blocks")
      .select("id, date_from, date_to, reason")
      .eq("offer_id", id)
      .gte("date_to", today)
      .order("date_from", { ascending: true });

    if (blocksError) throw new Error(blocksError.message);

    const [itemWithAvailability] = await attachTodayAvailabilityServer([data]);

    return NextResponse.json({
      item: {
        ...itemWithAvailability,
        views_count: Number(data.views_count || 0) + 1,
      },
      images: imageData || [],
      availabilityBlocks: blocksData || [],
      currentUserId: user?.id || null,
    });
  } catch (error) {
    const message = errorMessage(error, "Nabídku se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rate = await checkRateLimit({
    key: `offers:update:${id}:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const formData = await request.formData();
    const rawPayload = formData.get("payload");

    if (typeof rawPayload !== "string") {
      throw new Error("Chybí data nabídky");
    }

    const payload = JSON.parse(rawPayload) as UpdatePayload;
    const newPhotos = formData.getAll("photos").filter((value): value is File => value instanceof File);

    const { data: existingOffer, error: existingError } = await supabaseAdmin
      .from("offers")
      .select("id, owner_id, primary_image_url")
      .eq("id", id)
      .single();

    if (existingError || !existingOffer) {
      throw new Error("Nabídka nebyla nalezena");
    }

    if (existingOffer.owner_id !== user.id) {
      throw new Error("Tuhle nabídku může upravit pouze vlastník");
    }

    const { data: existingImages, error: imagesError } = await supabaseAdmin
      .from("offer_images")
      .select("id, image_url, sort_order")
      .eq("offer_id", id)
      .order("sort_order", { ascending: true });

    if (imagesError) {
      throw new Error(imagesError.message);
    }

    if (newPhotos.length > 8 || (existingImages?.length || 0) + newPhotos.length > 8) {
      throw new Error("Můžeš mít maximálně 8 fotek");
    }

    for (const photo of newPhotos) {
      if (photo.size > 15 * 1024 * 1024) {
        throw new Error("Jedna z fotek je větší než 15 MB");
      }
    }

    const offerType = payload.offer_type === "service" ? "service" : "item";

  if (offerType === "service") {
    const bookingMode = payload.service_booking_mode === "deadline" ? "deadline" : "scheduled";

    if (bookingMode === "scheduled") {
      const ranges = [
        [payload.weekday_start_time, payload.weekday_end_time, "pracovní dny"],
        [payload.weekend_start_time, payload.weekend_end_time, "víkend"],
      ] as const;

      for (const [start, end, label] of ranges) {
        if (!start || !end || end <= start) {
          throw new Error(`Nastav platnou provozní dobu pro ${label}`);
        }
      }
    }
  }

    if (offerType === "item" && (existingImages?.length || 0) + newPhotos.length === 0) {
      throw new Error("Nahraj alespoň jednu fotku věci");
    }

    if (!payload.title?.trim() || payload.title.trim().length > 120) {
      throw new Error("Vyplň název nabídky do 120 znaků");
    }

    if (!payload.description?.trim() || payload.description.length > 8000) {
      throw new Error("Vyplň popis nabídky");
    }

    if (!payload.category) throw new Error("Vyber kategorii");
    if (offerType === "item" && !payload.condition) throw new Error("Vyber stav nabídky");
    if (!payload.pickup_place?.trim() || !payload.pickup_latitude || !payload.pickup_longitude) throw new Error("Vyber lokalitu z našeptávače");
    if (offerType === "item" && (!Array.isArray(payload.handover_options) || payload.handover_options.length === 0)) throw new Error("Vyber alespoň jednu možnost předání");

    const allowedPriceUnits =
      offerType === "service"
        ? ["hour", "piece", "individual"]
        : ["day", "weekend", "week", "month"];

    if (!allowedPriceUnits.includes(payload.price_unit)) {
      throw new Error("Vyber platnou jednotku ceny");
    }

    const priceAmount =
      offerType === "service" && payload.price_unit === "individual"
        ? 0
        : Number(payload.price_amount);

    if (!Number.isFinite(priceAmount) || priceAmount < 0) throw new Error("Vyplň platnou cenu");

    const { error: updateError } = await supabaseAdmin
      .from("offers")
      .update({
        offer_type: offerType,
        title: payload.title.trim(),
        description: sanitizeRichText(payload.description),
        category: payload.category,
        condition: offerType === "item" ? payload.condition : null,
        price_amount: priceAmount,
        price_unit: payload.price_unit,
        price_note: payload.price_note?.trim() || null,
        deposit: offerType === "item" && payload.deposit ? Number(payload.deposit) : null,
        pickup_place: payload.pickup_place.trim(),
        pickup_latitude: payload.pickup_latitude,
        pickup_longitude: payload.pickup_longitude,
        handover_options: offerType === "item" ? payload.handover_options : [],
        contact_note: payload.contact_note?.trim() || null,
        service_booking_mode: offerType === "service"
          ? payload.service_booking_mode === "deadline" ? "deadline" : "scheduled"
          : null,
        service_hours_mode: offerType === "service" && payload.service_booking_mode !== "deadline"
          ? payload.service_hours_mode === "same_every_day" ? "same_every_day" : "weekday_weekend"
          : null,
        weekday_start_time: offerType === "service" && payload.service_booking_mode !== "deadline"
          ? payload.weekday_start_time || null
          : null,
        weekday_end_time: offerType === "service" && payload.service_booking_mode !== "deadline"
          ? payload.weekday_end_time || null
          : null,
        weekend_start_time: offerType === "service" && payload.service_booking_mode !== "deadline"
          ? payload.weekend_start_time || null
          : null,
        weekend_end_time: offerType === "service" && payload.service_booking_mode !== "deadline"
          ? payload.weekend_end_time || null
          : null,
        is_active: payload.is_active ?? true,
      })
      .eq("id", id);

    if (updateError) throw new Error(updateError.message);

    const currentCount = existingImages?.length || 0;
    let firstNewImageUrl: string | null = null;

    for (let index = 0; index < newPhotos.length; index++) {
      const photo = newPhotos[index];
      const filePath = `${user.id}/${id}/${Date.now()}-${index}-${randomUUID()}.webp`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("offers")
        .upload(filePath, photo, {
          contentType: photo.type || "image/webp",
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: publicUrl } = supabaseAdmin.storage.from("offers").getPublicUrl(filePath);
      if (index === 0) firstNewImageUrl = publicUrl.publicUrl;

      const { error: imageError } = await supabaseAdmin.from("offer_images").insert({
        offer_id: id,
        image_url: publicUrl.publicUrl,
        sort_order: currentCount + index,
      });

      if (imageError) throw new Error(imageError.message);
    }

    if (!existingOffer.primary_image_url && firstNewImageUrl) {
      await supabaseAdmin.from("offers").update({ primary_image_url: firstNewImageUrl }).eq("id", id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Změny se nepodařilo uložit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: offer, error } = await supabaseAdmin
      .from("offers")
      .select("id, owner_id, primary_image_url")
      .eq("id", id)
      .single();

    if (error || !offer) throw new Error("Nabídka nebyla nalezena");
    if (offer.owner_id !== user.id) throw new Error("Tuhle nabídku může smazat pouze vlastník");

    const { data: images } = await supabaseAdmin.from("offer_images").select("image_url").eq("offer_id", id);
    const paths = (images || []).map((image) => storagePathFromPublicUrl(image.image_url)).filter(Boolean) as string[];
    if (paths.length > 0) await supabaseAdmin.storage.from("offers").remove(paths);
    await supabaseAdmin.from("offer_images").delete().eq("offer_id", id);
    await supabaseAdmin.from("offers").delete().eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Nabídku se nepodařilo smazat");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
