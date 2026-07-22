import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 75 * 1024 * 1024;
const IMAGE_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const VIDEO_TYPES = new Map([["video/mp4", "mp4"], ["video/webm", "webm"]]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string; realizationId: string }> }) {
  const { id: offerId, realizationId } = await params;
  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const body = await request.json();
    const mediaType = body?.mediaType === "video" ? "video" : "image";
    const contentType = String(body?.contentType || "");
    const size = Number(body?.size || 0);
    const extension = mediaType === "video" ? VIDEO_TYPES.get(contentType) : IMAGE_TYPES.get(contentType);
    if (!extension) throw new Error(mediaType === "video" ? "Video musí být ve formátu MP4 nebo WebM" : "Fotografie musí být ve formátu JPG, PNG nebo WebP");
    const maxSize = mediaType === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (!Number.isFinite(size) || size <= 0 || size > maxSize) throw new Error(mediaType === "video" ? "Video může mít maximálně 75 MB" : "Fotografie může mít maximálně 10 MB");

    const { data: realization } = await supabaseAdmin.from("service_realizations").select("id, offer_id").eq("id", realizationId).eq("offer_id", offerId).maybeSingle();
    const { data: offer } = await supabaseAdmin.from("offers").select("owner_id, publication_status").eq("id", offerId).maybeSingle();
    if (!realization || !offer) throw new Error("Realizace nebyla nalezena");
    if (offer.owner_id !== user.id) throw new Error("Realizaci může upravovat pouze vlastník nabídky");
    if (offer.publication_status === "archived") throw new Error("Archivovanou nabídku nelze upravit");

    const table = mediaType === "video" ? "service_realization_videos" : "service_realization_images";
    const limit = mediaType === "video" ? 2 : 5;
    const { count } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true }).eq("realization_id", realizationId);
    if ((count || 0) >= limit) throw new Error(mediaType === "video" ? "Realizace může mít maximálně dvě videa" : "Realizace může mít maximálně pět fotografií");

    const basePath = `${user.id}/${offerId}/realizations/${realizationId}/${mediaType}s/${randomUUID()}`;
    const mediaPath = `${basePath}.${extension}`;
    const { data: mediaUpload, error: mediaError } = await supabaseAdmin.storage.from("offers").createSignedUploadUrl(mediaPath);
    if (mediaError || !mediaUpload) throw new Error("Soubor se nepodařilo připravit");

    let thumbnail = null;
    if (mediaType === "video" && body?.hasThumbnail) {
      const thumbnailPath = `${basePath}-thumbnail.jpg`;
      const { data, error } = await supabaseAdmin.storage.from("offers").createSignedUploadUrl(thumbnailPath);
      if (error || !data) throw new Error("Náhled videa se nepodařilo připravit");
      thumbnail = { path: thumbnailPath, token: data.token };
    }

    return NextResponse.json({ media: { path: mediaPath, token: mediaUpload.token }, thumbnail });
  } catch (error) {
    const message = errorMessage(error, "Soubor realizace se nepodařilo připravit");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
