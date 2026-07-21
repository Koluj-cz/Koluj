"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import SectionTitle from "@/app/components/SectionTitle";
import type { ExistingOfferVideo } from "@/app/components/offer-form/types";

export const MAX_VIDEO_SIZE_BYTES = 75 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 60;

export type SelectedOfferVideo = {
  file: File;
  previewUrl: string;
  thumbnailFile: File | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
};

type Props = {
  existingVideo?: ExistingOfferVideo | null;
  video: SelectedOfferVideo | null;
  setVideo: React.Dispatch<React.SetStateAction<SelectedOfferVideo | null>>;
  onDeleteExisting?: (video: ExistingOfferVideo) => void | Promise<void>;
};

export default function OfferVideoUploader({
  existingVideo = null,
  video,
  setVideo,
  onDeleteExisting,
}: Props) {
  const [processing, setProcessing] = useState(false);
  const currentVideoRef = useRef<SelectedOfferVideo | null>(null);

  useEffect(() => {
    currentVideoRef.current = video;
  }, [video]);

  useEffect(() => {
    return () => revokeVideoUrls(currentVideoRef.current);
  }, []);

  async function handleVideo(file: File | undefined) {
    if (!file) return;

    if (!(["video/mp4", "video/webm"] as string[]).includes(file.type)) {
      toast.error("Nahraj video ve formátu MP4 nebo WebM");
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      toast.error("Video může mít maximálně 75 MB");
      return;
    }

    setProcessing(true);

    try {
      const selected = await prepareVideo(file);
      if (selected.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        revokeVideoUrls(selected);
        toast.error("Video může mít maximálně 60 sekund");
        return;
      }

      revokeVideoUrls(video);
      setVideo(selected);
    } catch {
      toast.error("Video se nepodařilo načíst");
    } finally {
      setProcessing(false);
    }
  }

  function removeNewVideo() {
    revokeVideoUrls(video);
    setVideo(null);
  }

  const displayedVideoUrl = video?.previewUrl || existingVideo?.video_url || null;
  const posterUrl = video?.thumbnailUrl || existingVideo?.thumbnail_url || undefined;

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle icon={<Film size={24} />} title="Video (volitelné)" />

      <p className="mt-3 text-sm leading-relaxed text-[var(--koluj-muted)]">
        Přidej jedno krátké video, které nabídku lépe představí. Fotografie zůstávají hlavním obsahem nabídky.
      </p>

      {displayedVideoUrl ? (
        <div className="mt-6 overflow-hidden rounded-[28px] border border-[var(--koluj-border)] bg-black">
          <video
            src={displayedVideoUrl}
            poster={posterUrl}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full object-contain"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--koluj-surface)] p-4">
            <div>
              <p className="font-black">Video nabídky</p>
              <p className="mt-1 text-xs font-bold text-[var(--koluj-muted)]">
                MP4 nebo WebM · maximálně 60 s · do 75 MB
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (video) removeNewVideo();
                else if (existingVideo && onDeleteExisting) void onDeleteExisting(existingVideo);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-100"
            >
              <Trash2 size={17} /> Odebrat video
            </button>
          </div>
        </div>
      ) : (
        <label className="mt-6 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-surface)] px-5 text-center text-[var(--koluj-green)] transition hover:border-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]">
          <Plus size={32} />
          <span className="mt-2 font-black">{processing ? "Načítám video..." : "Přidat video"}</span>
          <span className="mt-1 text-xs font-bold text-[var(--koluj-muted)]">MP4 nebo WebM · maximálně 60 s · do 75 MB</span>
          <input
            type="file"
            accept="video/mp4,video/webm"
            disabled={processing}
            onChange={(event) => {
              void handleVideo(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function revokeVideoUrls(video: SelectedOfferVideo | null) {
  if (!video) return;
  URL.revokeObjectURL(video.previewUrl);
  if (video.thumbnailUrl) URL.revokeObjectURL(video.thumbnailUrl);
}

async function prepareVideo(file: File): Promise<SelectedOfferVideo> {
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
    const maxWidth = 1280;
    const ratio = Math.min(1, maxWidth / Math.max(video.videoWidth, 1));
    canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
    canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (blob) {
      thumbnailFile = new File([blob], "video-thumbnail.jpg", { type: "image/jpeg" });
      thumbnailUrl = URL.createObjectURL(blob);
    }
  } catch {
    // Náhled je volitelný, video lze uložit i bez něj.
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
