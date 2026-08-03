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

export async function uploadServiceRealization(
  offerId: string,
  realization: ServiceRealizationDraft,
  sortOrder: number,
  onProgress?: (value: number, label: string) => void,
) {
  onProgress?.(3, "Vytvářím realizaci...");
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
    const totalMedia = realization.files.length + realization.videos.length;
    let completedMedia = 0;

    for (let index = 0; index < realization.files.length; index += 1) {
      onProgress?.(8 + (completedMedia / Math.max(totalMedia, 1)) * 84, `Nahrávám fotografii realizace ${index + 1}/${realization.files.length}...`);
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
      completedMedia += 1;
    }

    for (let index = 0; index < realization.videos.length; index += 1) {
      onProgress?.(8 + (completedMedia / Math.max(totalMedia, 1)) * 84, `Nahrávám video realizace ${index + 1}/${realization.videos.length}...`);
      const video = realization.videos[index];
      const prepared = await prepareUpload(
        offerId,
        realizationId,
        "video",
        video.file,
        Boolean(video.thumbnailFile),
        video.moderationFrameFiles.length,
      );
      await uploadToSignedStorageUrl({ path: prepared.media.path, token: prepared.media.token, file: video.file });
      if (video.thumbnailFile && prepared.thumbnail) {
        await uploadToSignedStorageUrl({ path: prepared.thumbnail.path, token: prepared.thumbnail.token, file: video.thumbnailFile });
      }
      const uploadedModerationFramePaths: string[] = [];
      const moderationFrames = Array.isArray(prepared.moderationFrames)
        ? prepared.moderationFrames
        : [];
      for (let frameIndex = 0; frameIndex < video.moderationFrameFiles.length; frameIndex += 1) {
        const frameFile = video.moderationFrameFiles[frameIndex];
        const preparedFrame = moderationFrames[frameIndex];
        if (!preparedFrame) break;
        try {
          await uploadToSignedStorageUrl({
            path: preparedFrame.path,
            token: preparedFrame.token,
            file: frameFile,
            stage: "moderation-frame",
            maxAttempts: 2,
          });
          uploadedModerationFramePaths.push(preparedFrame.path);
        } catch {
          // Missing samples fall back to the remaining uploaded frames or thumbnail.
        }
      }
      await commitMedia(offerId, realizationId, {
        mediaType: "video",
        mediaPath: prepared.media.path,
        thumbnailPath: prepared.thumbnail?.path || null,
        durationSeconds: video.durationSeconds,
        sortOrder: index,
        moderationFramePaths: uploadedModerationFramePaths,
      });
      completedMedia += 1;
    }

    onProgress?.(100, "Realizace byla nahrána");
    return { ok: true, realizationId };
  } catch (error) {
    await fetch(`/api/offers/${offerId}/realizations/${realizationId}`, { method: "DELETE" }).catch(() => null);
    throw error;
  }
}

async function prepareUpload(
  offerId: string,
  realizationId: string,
  mediaType: "image" | "video",
  file: File,
  hasThumbnail: boolean,
  moderationFrameCount = 0,
) {
  const response = await fetch(`/api/offers/${offerId}/realizations/${realizationId}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mediaType,
      contentType: file.type,
      size: file.size,
      hasThumbnail,
      moderationFrameCount,
    }),
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
