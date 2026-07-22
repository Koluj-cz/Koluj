import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";

function storagePathFromPublicUrl(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/offers/";
  return url.includes(marker) ? url.split(marker)[1] || null : null;
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; realizationId: string }> }) {
  const { id: offerId, realizationId } = await params;
  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: realization, error } = await supabaseAdmin
      .from("service_realizations")
      .select("id, offer_id, service_realization_images(image_url), service_realization_videos(video_url, thumbnail_url)")
      .eq("id", realizationId)
      .eq("offer_id", offerId)
      .maybeSingle();
    if (error || !realization) throw new Error("Realizace nebyla nalezena");

    const { data: offer } = await supabaseAdmin.from("offers").select("owner_id").eq("id", offerId).maybeSingle();
    if (!offer) throw new Error("Nabídka nebyla nalezena");
    if (offer.owner_id !== user.id) throw new Error("Realizaci může smazat pouze vlastník nabídky");

    const images = (realization.service_realization_images || []) as { image_url: string }[];
    const videos = (realization.service_realization_videos || []) as { video_url: string; thumbnail_url: string | null }[];
    const paths = [
      ...images.map((image) => storagePathFromPublicUrl(image.image_url)),
      ...videos.flatMap((video) => [storagePathFromPublicUrl(video.video_url), storagePathFromPublicUrl(video.thumbnail_url)]),
    ].filter((path): path is string => Boolean(path));
    if (paths.length > 0) await supabaseAdmin.storage.from("offers").remove(paths);

    const { error: deleteError } = await supabaseAdmin.from("service_realizations").delete().eq("id", realizationId);
    if (deleteError) throw new Error(deleteError.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Realizaci se nepodařilo smazat");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
