import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type PreparedBrowserVideo = {
  file: File;
  previewUrl: string;
  thumbnailFile: File | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
};

export async function uploadToSignedStorageUrl(params: {
  bucket?: string;
  path: string;
  token: string;
  file: File;
}) {
  const supabase = createSupabaseBrowserClient();
  const result = await supabase.storage
    .from(params.bucket || "offers")
    .uploadToSignedUrl(params.path, params.token, params.file, {
      contentType: params.file.type,
    });
  if (result.error) throw new Error("Soubor se nepodařilo nahrát");
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
    const timeout = window.setTimeout(() => reject(new Error("Video timeout")), 10000);
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
