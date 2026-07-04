import { NextResponse } from "next/server";
import { requireUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";

function storagePathFromPublicUrl(url: string | null) {
  const marker = "/storage/v1/object/public/offers/";
  if (!url || !url.includes(marker)) return null;
  return url.split(marker)[1] || null;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const { id, imageId } = await params;

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: offer, error: offerError } = await supabaseAdmin
      .from("offers")
      .select("id, owner_id, primary_image_url")
      .eq("id", id)
      .single();

    if (offerError || !offer) throw new Error("Nabídka nebyla nalezena");
    if (offer.owner_id !== user.id) throw new Error("Fotku může smazat pouze vlastník nabídky");

    const { data: image, error: imageError } = await supabaseAdmin
      .from("offer_images")
      .select("id, image_url")
      .eq("id", imageId)
      .eq("offer_id", id)
      .single();

    if (imageError || !image) throw new Error("Fotka nebyla nalezena");

    await supabaseAdmin.from("offer_images").delete().eq("id", imageId);

    const storagePath = storagePathFromPublicUrl(image.image_url);
    if (storagePath) await supabaseAdmin.storage.from("offers").remove([storagePath]);

    let primaryImageUrl = offer.primary_image_url;
    if (primaryImageUrl === image.image_url) {
      const { data: remaining } = await supabaseAdmin
        .from("offer_images")
        .select("image_url")
        .eq("offer_id", id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      primaryImageUrl = remaining?.image_url || null;
      await supabaseAdmin.from("offers").update({ primary_image_url: primaryImageUrl }).eq("id", id);
    }

    return NextResponse.json({ ok: true, primaryImageUrl });
  } catch (error) {
    const message = errorMessage(error, "Fotku se nepodařilo smazat");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
