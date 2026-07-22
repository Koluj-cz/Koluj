import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; realizationId: string }> }) {
  const { id: offerId, realizationId } = await params;
  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const body = await request.json();
    const mediaType = body?.mediaType === "video" ? "video" : "image";
    const mediaPath = String(body?.mediaPath || "");
    const thumbnailPath = body?.thumbnailPath ? String(body.thumbnailPath) : null;
    const sortOrder = Number(body?.sortOrder || 0);
    const prefix = `${user.id}/${offerId}/realizations/${realizationId}/${mediaType}s/`;
    if (!mediaPath.startsWith(prefix)) throw new Error("Neplatná cesta souboru");
    if (thumbnailPath && !thumbnailPath.startsWith(prefix)) throw new Error("Neplatná cesta náhledu");

    const { data: realization } = await supabaseAdmin.from("service_realizations").select("id").eq("id", realizationId).eq("offer_id", offerId).maybeSingle();
    const { data: offer } = await supabaseAdmin.from("offers").select("owner_id").eq("id", offerId).maybeSingle();
    if (!realization || !offer) throw new Error("Realizace nebyla nalezena");
    if (offer.owner_id !== user.id) throw new Error("Realizaci může upravovat pouze vlastník nabídky");

    const mediaUrl = supabaseAdmin.storage.from("offers").getPublicUrl(mediaPath).data.publicUrl;
    if (mediaType === "image") {
      const { error } = await supabaseAdmin.from("service_realization_images").insert({ realization_id: realizationId, image_url: mediaUrl, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0 });
      if (error) throw new Error(error.message);
    } else {
      const durationSeconds = Number(body?.durationSeconds || 0);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60) throw new Error("Video může mít maximálně 60 sekund");
      const thumbnailUrl = thumbnailPath ? supabaseAdmin.storage.from("offers").getPublicUrl(thumbnailPath).data.publicUrl : null;
      const { error } = await supabaseAdmin.from("service_realization_videos").insert({ realization_id: realizationId, video_url: mediaUrl, thumbnail_url: thumbnailUrl, duration_seconds: durationSeconds, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0 });
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Médium realizace se nepodařilo uložit");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
