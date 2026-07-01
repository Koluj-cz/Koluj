import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getStoragePathFromPublicUrl(url: string | null) {
  if (!url) return null;

  const marker = "/storage/v1/object/public/offers/";

  if (!url.includes(marker)) {
    return null;
  }

  return url.split(marker)[1] || null;
}

export async function archiveOfferServer({
  offerId,
  actorId,
}: {
  offerId: string;
  actorId: string;
}) {
  const { data: item, error: itemError } = await supabaseAdmin
    .from("offers")
    .select("id, owner_id, deleted_at")
    .eq("id", offerId)
    .single();

  if (itemError || !item) {
    throw new Error("Nabídka nebyla nalezena");
  }

  if (item.owner_id !== actorId) {
    throw new Error("Tuhle nabídku může odstranit pouze vlastník");
  }

  if (item.deleted_at) {
    return {
      ok: true,
      mode: "archived",
    };
  }

  const { count: bookingCount, error: bookingCountError } = await supabaseAdmin
    .from("bookings")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("offer_id", offerId);

  if (bookingCountError) {
    throw new Error(bookingCountError.message);
  }

  if ((bookingCount || 0) === 0) {
    const { data: images, error: imagesError } = await supabaseAdmin
      .from("offer_images")
      .select("image_url")
      .eq("offer_id", offerId);

    if (imagesError) {
      throw new Error(imagesError.message);
    }

    const storagePaths =
      images
        ?.map((image) => getStoragePathFromPublicUrl(image.image_url))
        .filter(Boolean) || [];

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("offers")
        .remove(storagePaths as string[]);

      if (storageError) {
        throw new Error(storageError.message);
      }
    }

    const { error: imageDeleteError } = await supabaseAdmin
      .from("offer_images")
      .delete()
      .eq("offer_id", offerId);

    if (imageDeleteError) {
      throw new Error(imageDeleteError.message);
    }

    const { error: itemDeleteError } = await supabaseAdmin
      .from("offers")
      .delete()
      .eq("id", offerId);

    if (itemDeleteError) {
      throw new Error(itemDeleteError.message);
    }

    return {
      ok: true,
      mode: "deleted",
    };
  }

  const { error } = await supabaseAdmin
    .from("offers")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
    })
    .eq("id", offerId);

  if (error) {
    throw new Error(error.message);
  }

  return {
    ok: true,
    mode: "archived",
  };
}