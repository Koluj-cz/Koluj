import * as Sentry from "@sentry/nextjs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type PreparedBrowserVideo = {
  file: File;
  previewUrl: string;
  thumbnailFile: File | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
};

export type UploadStage = "video" | "thumbnail" | "moderation-frame";

export class MediaUploadError extends Error {
  stage: UploadStage;
  technicalMessage: string;

  constructor(stage: UploadStage, userMessage: string, technicalMessage: string) {
    super(userMessage);
    this.name = "MediaUploadError";
    this.stage = stage;
    this.technicalMessage = technicalMessage;
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function uploadToSignedStorageUrl(params: {
  bucket?: string;
  path: string;
  token: string;
  file: File;
  stage?: UploadStage;
  maxAttempts?: number;
}) {
  const supabase = createSupabaseBrowserClient();
  const stage = params.stage || "video";
  const maxAttempts = Math.max(1, params.maxAttempts || 2);
  let lastTechnicalMessage = "Neznámá chyba uploadu";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await supabase.storage
        .from(params.bucket || "offers")
        .uploadToSignedUrl(params.path, params.token, params.file, {
          contentType: params.file.type || "application/octet-stream",
          upsert: true,
        });

      if (!result.error) return;

      lastTechnicalMessage = result.error.message || String(result.error);
    } catch (error) {
      lastTechnicalMessage = error instanceof Error ? error.message : String(error);
    }

    if (attempt < maxAttempts) {
      await wait(700 * attempt);
    }
  }

  const userMessage =
    stage === "video"
      ? "video se nepodařilo nahrát. Zkontroluj připojení a zkus to znovu"
      : stage === "thumbnail"
        ? "náhled videa se nepodařilo nahrát"
        : "kontrolní snímek videa se nepodařilo nahrát";

  const uploadError = new MediaUploadError(stage, userMessage, lastTechnicalMessage);

  Sentry.captureException(uploadError, {
    tags: {
      operation: "signed-storage-upload",
      upload_stage: stage,
    },
    extra: {
      path: params.path,
      bucket: params.bucket || "offers",
      fileName: params.file.name,
      fileType: params.file.type,
      fileSize: params.file.size,
      attempts: maxAttempts,
      online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
      technicalMessage: lastTechnicalMessage,
    },
  });

  throw uploadError;
}

export function revokePreparedVideoUrls(video: PreparedBrowserVideo) {
  URL.revokeObjectURL(video.previewUrl);
  if (video.thumbnailUrl) URL.revokeObjectURL(video.thumbnailUrl);
}

export async function prepareBrowserVideo(file: File): Promise<PreparedBrowserVideo> {
  const previewUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = previewUrl;

  await waitForEvent(video, "loadedmetadata");
  const durationSeconds = Math.ceil(video.duration || 0);
  let thumbnailFile: File | null = null;
  let thumbnailUrl: string | null = null;

  try {
    video.currentTime = Math.min(Math.max(video.duration * 0.1, 0.1), 1);
    await waitForEvent(video, "seeked");
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 1280 / Math.max(video.videoWidth, 1));
    canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
    canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (blob) {
      thumbnailFile = new File([blob], "video-thumbnail.jpg", { type: "image/jpeg" });
      thumbnailUrl = URL.createObjectURL(blob);
    }
  } catch {
    // Thumbnail is optional.
  }

  return { file, previewUrl, thumbnailFile, thumbnailUrl, durationSeconds };
}

function waitForEvent(element: HTMLMediaElement, eventName: "loadedmetadata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Video timeout")), 15000);
    const handleSuccess = () => {
      window.clearTimeout(timeout);
      element.removeEventListener("error", handleError);
      resolve();
    };
    const handleError = () => {
      window.clearTimeout(timeout);
      element.removeEventListener(eventName, handleSuccess);
      reject(new Error("Video error"));
    };
    element.addEventListener(eventName, handleSuccess, { once: true });
    element.addEventListener("error", handleError, { once: true });
  });
}
