import type { SelectedOfferVideo } from "@/app/components/offer-form/OfferVideoUploader";
import { uploadToSignedStorageUrl } from "@/lib/mediaUpload";

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

  await uploadToSignedStorageUrl({ path: prepared.video.path, token: prepared.video.token, file: video.file });

  if (video.thumbnailFile && prepared.thumbnail) {
    await uploadToSignedStorageUrl({ path: prepared.thumbnail.path, token: prepared.thumbnail.token, file: video.thumbnailFile });
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
