import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";

const MAX_VIDEO_SIZE = 75 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const body = await request.json();
    const contentType = String(body?.contentType || "");
    const size = Number(body?.size || 0);
    const extension = ALLOWED_VIDEO_TYPES.get(contentType);

    if (!extension) throw new Error("Video musí být ve formátu MP4 nebo WebM");
    if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_SIZE) {
      throw new Error("Video může mít maximálně 75 MB");
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

    const basePath = `${user.id}/${id}/videos/${randomUUID()}`;
    const videoPath = `${basePath}.${extension}`;
    const { data: videoUpload, error: videoError } = await supabaseAdmin.storage
      .from("offers")
      .createSignedUploadUrl(videoPath);
    if (videoError || !videoUpload) throw new Error("Video se nepodařilo připravit");

    let thumbnail: { path: string; token: string } | null = null;
    if (body?.hasThumbnail) {
      const thumbnailPath = `${basePath}-thumbnail.jpg`;
      const { data: thumbnailUpload, error: thumbnailError } = await supabaseAdmin.storage
        .from("offers")
        .createSignedUploadUrl(thumbnailPath);
      if (thumbnailError || !thumbnailUpload) throw new Error("Náhled videa se nepodařilo připravit");
      thumbnail = { path: thumbnailPath, token: thumbnailUpload.token };
    }

    return NextResponse.json({
      video: { path: videoPath, token: videoUpload.token },
      thumbnail,
    });
  } catch (error) {
    const message = errorMessage(error, "Video se nepodařilo připravit");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
