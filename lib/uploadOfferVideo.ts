import type { SelectedOfferVideo } from "@/app/components/offer-form/OfferVideoUploader";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function uploadOfferVideo(offerId: string, video: SelectedOfferVideo) {
  const prepareResponse = await fetch(`/api/offers/${offerId}/videos/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: video.file.name,
      contentType: video.file.type,
      size: video.file.size,
      hasThumbnail: Boolean(video.thumbnailFile),
    }),
  });

  const prepared = await prepareResponse.json().catch(() => null);
  if (!prepareResponse.ok) throw new Error(prepared?.error || "Video se nepodařilo připravit");

  const supabase = createSupabaseBrowserClient();
  const videoUpload = await supabase.storage
    .from("offers")
    .uploadToSignedUrl(prepared.video.path, prepared.video.token, video.file, {
      contentType: video.file.type,
    });
  if (videoUpload.error) throw new Error("Video se nepodařilo nahrát");

  if (video.thumbnailFile && prepared.thumbnail) {
    const thumbnailUpload = await supabase.storage
      .from("offers")
      .uploadToSignedUrl(prepared.thumbnail.path, prepared.thumbnail.token, video.thumbnailFile, {
        contentType: video.thumbnailFile.type,
      });
    if (thumbnailUpload.error) throw new Error("Náhled videa se nepodařilo nahrát");
  }

  const commitResponse = await fetch(`/api/offers/${offerId}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoPath: prepared.video.path,
      thumbnailPath: prepared.thumbnail?.path || null,
      durationSeconds: video.durationSeconds,
    }),
  });

  const committed = await commitResponse.json().catch(() => null);
  if (!commitResponse.ok) throw new Error(committed?.error || "Video se nepodařilo uložit");
  return committed.video;
}
