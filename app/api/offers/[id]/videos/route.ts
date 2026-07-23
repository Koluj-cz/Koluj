import { after, NextResponse } from "next/server";
import { requireUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { processMediaById } from "@/lib/services/mediaModerationService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const body = await request.json();
    const videoPath = String(body?.videoPath || "");
    const thumbnailPath = body?.thumbnailPath ? String(body.thumbnailPath) : null;
    const durationSeconds = Number(body?.durationSeconds || 0);
    const moderationFramePaths = Array.isArray(body?.moderationFramePaths)
      ? body.moderationFramePaths.map(String).slice(0, 8)
      : [];
    const requiredPrefix = `${user.id}/${id}/videos/`;

    if (!videoPath.startsWith(requiredPrefix)) throw new Error("Neplatná cesta videa");
    if (thumbnailPath && !thumbnailPath.startsWith(requiredPrefix)) throw new Error("Neplatná cesta náhledu");
    if (moderationFramePaths.some((path: string) => !path.startsWith(requiredPrefix))) throw new Error("Neplatná cesta kontrolního snímku");
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60) {
      throw new Error("Video může mít maximálně 60 sekund");
    }

    const { data: offer, error: offerError } = await supabaseAdmin
      .from("offers")
      .select("id, owner_id, publication_status")
      .eq("id", id)
      .single();
    if (offerError || !offer) throw new Error("Nabídka nebyla nalezena");
    if (offer.owner_id !== user.id) throw new Error("Video může přidat pouze vlastník nabídky");
    if (offer.publication_status === "archived") throw new Error("Archivovanou nabídku nelze upravit");

    const { count } = await supabaseAdmin
      .from("offer_videos")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", id);
    if ((count || 0) >= 3) throw new Error("K nabídce můžeš přidat maximálně tři videa");

    const videoUrl = supabaseAdmin.storage.from("offers").getPublicUrl(videoPath).data.publicUrl;
    const thumbnailUrl = thumbnailPath
      ? supabaseAdmin.storage.from("offers").getPublicUrl(thumbnailPath).data.publicUrl
      : null;

    const { data: video, error: insertError } = await supabaseAdmin
      .from("offer_videos")
      .insert({
        offer_id: id,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        duration_seconds: durationSeconds,
        sort_order: count || 0,
        moderation_status: "pending",
      })
      .select("id, video_url, thumbnail_url, duration_seconds, sort_order")
      .single();

    if (insertError || !video) throw new Error(insertError?.message || "Video se nepodařilo uložit");

    const moderationFrameUrls = moderationFramePaths.map((path: string) =>
      supabaseAdmin.storage.from("offers").getPublicUrl(path).data.publicUrl,
    );

    after(async () => {
      await processMediaById("offer_videos", video.id, moderationFrameUrls);
    });

    return NextResponse.json({ ok: true, video });
  } catch (error) {
    const message = errorMessage(error, "Video se nepodařilo uložit");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
