import * as Sentry from "@sentry/nextjs";
import type { SelectedOfferVideo } from "@/app/components/offer-form/OfferVideoUploader";
import { uploadToSignedStorageUrl } from "@/lib/mediaUpload";

type PreparedUpload = {
  video: { path: string; token: string };
  thumbnail?: { path: string; token: string } | null;
  moderationFrames?: Array<{ path: string; token: string }>;
};

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

async function requestPreparedUpload(
  offerId: string,
  video: SelectedOfferVideo,
): Promise<PreparedUpload> {
  const prepareResponse = await fetch(`/api/offers/${offerId}/videos/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: video.file.name,
      contentType: video.file.type,
      size: video.file.size,
      hasThumbnail: Boolean(video.thumbnailFile),
      moderationFrameCount: video.moderationFrameFiles.length,
    }),
  });

  const prepared = await readJson(prepareResponse);

  if (!prepareResponse.ok || !prepared?.video?.path || !prepared?.video?.token) {
    throw new Error(prepared?.error || "Video se nepodařilo připravit");
  }

  return prepared as PreparedUpload;
}

async function prepareAndUploadMainVideo(
  offerId: string,
  video: SelectedOfferVideo,
  onProgress?: (value: number, label: string) => void,
) {
  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      onProgress?.(5, "Nahrávám video...");
      const prepared = await requestPreparedUpload(offerId, video);

      onProgress?.(12, "Nahrávám video...");
      await uploadToSignedStorageUrl({
        path: prepared.video.path,
        token: prepared.video.token,
        file: video.file,
        stage: "video",
        maxAttempts: 1,
      });

      return prepared;
    } catch (error) {
      lastError = error;

      Sentry.captureException(error, {
        level: attempt < maxAttempts ? "warning" : "error",
        tags: {
          operation: "offer-video-main-upload-attempt",
          upload_attempt: String(attempt),
        },
        extra: {
          offerId,
          fileName: video.file.name,
          fileType: video.file.type,
          fileSize: video.file.size,
          online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        },
      });

      if (attempt < maxAttempts) {
        onProgress?.(8, "Nahrávání opakuji...");
        await wait(900 * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Video se nepodařilo nahrát. Zkontroluj připojení a zkus to znovu");
}

export async function uploadOfferVideo(
  offerId: string,
  video: SelectedOfferVideo,
  onProgress?: (value: number, label: string) => void,
) {
  try {
    const prepared = await prepareAndUploadMainVideo(offerId, video, onProgress);
    onProgress?.(62, "Nahrávám video...");

    let uploadedThumbnailPath: string | null = null;

    if (video.thumbnailFile && prepared.thumbnail) {
      try {
        await uploadToSignedStorageUrl({
          path: prepared.thumbnail.path,
          token: prepared.thumbnail.token,
          file: video.thumbnailFile,
          stage: "thumbnail",
          maxAttempts: 2,
        });
        uploadedThumbnailPath = prepared.thumbnail.path;
      } catch (thumbnailError) {
        Sentry.captureException(thumbnailError, {
          tags: { operation: "offer-video-thumbnail-upload" },
          extra: { offerId, fileName: video.file.name },
        });
        // Náhled je volitelný. Video se uloží i bez něj.
      }
    }

    onProgress?.(72, "Nahrávám video...");
    const uploadedModerationFramePaths: string[] = [];
    const moderationFrames = Array.isArray(prepared.moderationFrames)
      ? prepared.moderationFrames
      : [];

    for (let index = 0; index < video.moderationFrameFiles.length; index += 1) {
      const frameFile = video.moderationFrameFiles[index];
      const preparedFrame = moderationFrames[index];

      if (!preparedFrame) break;

      try {
        onProgress?.(
          72 + ((index + 1) / Math.max(video.moderationFrameFiles.length, 1)) * 18,
          "Nahrávám video...",
        );
        await uploadToSignedStorageUrl({
          path: preparedFrame.path,
          token: preparedFrame.token,
          file: frameFile,
          stage: "moderation-frame",
          maxAttempts: 2,
        });
        uploadedModerationFramePaths.push(preparedFrame.path);
      } catch (frameError) {
        Sentry.captureException(frameError, {
          tags: { operation: "offer-video-moderation-frame-upload" },
          extra: { offerId, fileName: video.file.name, frame: index + 1 },
        });
      }
    }

    onProgress?.(92, "Ukládám video...");
    const commitResponse = await fetch(`/api/offers/${offerId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoPath: prepared.video.path,
        thumbnailPath: uploadedThumbnailPath,
        durationSeconds: video.durationSeconds,
        moderationFramePaths: uploadedModerationFramePaths,
      }),
    });

    const committed = await readJson(commitResponse);

    if (!commitResponse.ok) {
      throw new Error(committed?.error || "Video se nepodařilo uložit");
    }

    onProgress?.(100, "Video bylo nahráno");
    return committed.video;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: "offer-video-upload" },
      extra: {
        offerId,
        fileName: video.file.name,
        fileType: video.file.type,
        fileSize: video.file.size,
        durationSeconds: video.durationSeconds,
        online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
    });
    throw error;
  }
}
