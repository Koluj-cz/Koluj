import { NextResponse } from "next/server";
import { requireUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";

function storagePathFromPublicUrl(url: string | null) {
  const marker = "/storage/v1/object/public/offers/";
  if (!url || !url.includes(marker)) return null;
  return url.split(marker)[1] || null;
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; videoId: string }> }) {
  const { id, videoId } = await params;

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: offer } = await supabaseAdmin.from("offers").select("owner_id").eq("id", id).single();
    if (!offer) throw new Error("Nabídka nebyla nalezena");
    if (offer.owner_id !== user.id) throw new Error("Video může smazat pouze vlastník nabídky");

    const { data: video, error } = await supabaseAdmin
      .from("offer_videos")
      .select("id, video_url, thumbnail_url")
      .eq("id", videoId)
      .eq("offer_id", id)
      .single();
    if (error || !video) throw new Error("Video nebylo nalezeno");

    const paths = [storagePathFromPublicUrl(video.video_url), storagePathFromPublicUrl(video.thumbnail_url)]
      .filter(Boolean) as string[];
    if (paths.length > 0) await supabaseAdmin.storage.from("offers").remove(paths);
    await supabaseAdmin.from("offer_videos").delete().eq("id", videoId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Video se nepodařilo smazat");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
