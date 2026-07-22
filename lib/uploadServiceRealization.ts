import type { PreparedBrowserVideo } from "@/lib/mediaUpload";
import { uploadToSignedStorageUrl } from "@/lib/mediaUpload";

export type ServiceRealizationDraft = {
  localId: string;
  title: string;
  description: string;
  indicativePriceFrom: string;
  files: File[];
  previews: string[];
  videos: PreparedBrowserVideo[];
};

async function jsonResponse(response: Response, fallback: string) {
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || fallback);
  return result;
}

export async function uploadServiceRealization(offerId: string, realization: ServiceRealizationDraft, sortOrder: number) {
  const createResponse = await fetch(`/api/offers/${offerId}/realizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: realization.title.trim(),
      description: realization.description.trim(),
      indicativePriceFrom: realization.indicativePriceFrom.trim(),
      sortOrder,
    }),
  });
  const created = await jsonResponse(createResponse, "Realizaci se nepodařilo vytvořit");
  const realizationId = String(created.realizationId);

  try {
    for (let index = 0; index < realization.files.length; index += 1) {
      const file = realization.files[index];
      const prepared = await prepareUpload(offerId, realizationId, "image", file, false);
      await uploadToSignedStorageUrl({ path: prepared.media.path, token: prepared.media.token, file });
      await commitMedia(offerId, realizationId, {
        mediaType: "image",
        mediaPath: prepared.media.path,
        thumbnailPath: null,
        durationSeconds: null,
        sortOrder: index,
      });
    }

    for (let index = 0; index < realization.videos.length; index += 1) {
      const video = realization.videos[index];
      const prepared = await prepareUpload(offerId, realizationId, "video", video.file, Boolean(video.thumbnailFile));
      await uploadToSignedStorageUrl({ path: prepared.media.path, token: prepared.media.token, file: video.file });
      if (video.thumbnailFile && prepared.thumbnail) {
        await uploadToSignedStorageUrl({ path: prepared.thumbnail.path, token: prepared.thumbnail.token, file: video.thumbnailFile });
      }
      await commitMedia(offerId, realizationId, {
        mediaType: "video",
        mediaPath: prepared.media.path,
        thumbnailPath: prepared.thumbnail?.path || null,
        durationSeconds: video.durationSeconds,
        sortOrder: index,
      });
    }

    return { ok: true, realizationId };
  } catch (error) {
    await fetch(`/api/offers/${offerId}/realizations/${realizationId}`, { method: "DELETE" }).catch(() => null);
    throw error;
  }
}

async function prepareUpload(offerId: string, realizationId: string, mediaType: "image" | "video", file: File, hasThumbnail: boolean) {
  const response = await fetch(`/api/offers/${offerId}/realizations/${realizationId}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaType, contentType: file.type, size: file.size, hasThumbnail }),
  });
  return jsonResponse(response, "Soubor realizace se nepodařilo připravit");
}

async function commitMedia(offerId: string, realizationId: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/offers/${offerId}/realizations/${realizationId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonResponse(response, "Médium realizace se nepodařilo uložit");
}
