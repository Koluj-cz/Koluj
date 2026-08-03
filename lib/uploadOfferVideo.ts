import * as Sentry from "@sentry/nextjs";
import type { SelectedOfferVideo } from "@/app/components/offer-form/OfferVideoUploader";
import { uploadToSignedStorageUrl } from "@/lib/mediaUpload";

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

export async function uploadOfferVideo(offerId: string, video: SelectedOfferVideo) {
  try {
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
    if (!prepareResponse.ok) throw new Error(prepared?.error || "Video se nepodařilo připravit");

    await uploadToSignedStorageUrl({
      path: prepared.video.path,
      token: prepared.video.token,
      file: video.file,
      stage: "video",
      maxAttempts: 2,
    });

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

    const uploadedModerationFramePaths: string[] = [];
    const moderationFrames = Array.isArray(prepared.moderationFrames)
      ? prepared.moderationFrames
      : [];

    for (let index = 0; index < video.moderationFrameFiles.length; index += 1) {
      const frameFile = video.moderationFrameFiles[index];
      const preparedFrame = moderationFrames[index];
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
      } catch (frameError) {
        Sentry.captureException(frameError, {
          tags: { operation: "offer-video-moderation-frame-upload" },
          extra: { offerId, fileName: video.file.name, frame: index + 1 },
        });
      }
    }

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
    if (!commitResponse.ok) throw new Error(committed?.error || "Video se nepodařilo uložit");
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
