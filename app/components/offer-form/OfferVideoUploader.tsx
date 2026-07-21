"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import SectionTitle from "@/app/components/SectionTitle";
import type { ExistingOfferVideo } from "@/app/components/offer-form/types";

export const MAX_OFFER_VIDEOS = 3;
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
  existingVideos?: ExistingOfferVideo[];
  videos: SelectedOfferVideo[];
  setVideos: React.Dispatch<React.SetStateAction<SelectedOfferVideo[]>>;
  onDeleteExisting?: (video: ExistingOfferVideo) => void | Promise<void>;
};

export default function OfferVideoUploader({
  existingVideos = [],
  videos,
  setVideos,
  onDeleteExisting,
}: Props) {
  const [processing, setProcessing] = useState(false);
  const currentVideosRef = useRef<SelectedOfferVideo[]>([]);
  const totalCount = existingVideos.length + videos.length;
  const canAddMore = totalCount < MAX_OFFER_VIDEOS;

  useEffect(() => {
    currentVideosRef.current = videos;
  }, [videos]);

  useEffect(() => {
    return () => currentVideosRef.current.forEach(revokeVideoUrls);
  }, []);

  async function handleVideos(files: FileList | null) {
    if (!files?.length) return;

    const remainingSlots = MAX_OFFER_VIDEOS - totalCount;
    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast.error(`K nabídce můžeš přidat maximálně ${MAX_OFFER_VIDEOS} videa`);
    }

    setProcessing(true);
    const preparedVideos: SelectedOfferVideo[] = [];

    try {
      for (const file of selectedFiles) {
        if (!( ["video/mp4", "video/webm"] as string[]).includes(file.type)) {
          toast.error(`${file.name}: podporujeme pouze MP4 nebo WebM`);
          continue;
        }

        if (file.size > MAX_VIDEO_SIZE_BYTES) {
          toast.error(`${file.name}: video může mít maximálně 75 MB`);
          continue;
        }

        try {
          const selected = await prepareVideo(file);
          if (selected.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
            revokeVideoUrls(selected);
            toast.error(`${file.name}: video může mít maximálně 60 sekund`);
            continue;
          }
          preparedVideos.push(selected);
        } catch {
          toast.error(`${file.name}: video se nepodařilo načíst`);
        }
      }

      if (preparedVideos.length > 0) {
        setVideos((current) => [...current, ...preparedVideos].slice(0, MAX_OFFER_VIDEOS));
      }
    } finally {
      setProcessing(false);
    }
  }

  function removeNewVideo(index: number) {
    setVideos((current) => {
      const selected = current[index];
      if (selected) revokeVideoUrls(selected);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle icon={<Film size={24} />} title="Videa" />

      <p className="mt-3 text-sm leading-relaxed text-[var(--koluj-muted)]">
        Přidej až tři krátká videa, která nabídku lépe představí. Fotografie zůstávají hlavním obsahem nabídky.
      </p>

      {totalCount > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {existingVideos.map((video) => (
            <VideoCard
              key={video.id}
              src={video.video_url}
              poster={video.thumbnail_url || undefined}
              onRemove={onDeleteExisting ? () => void onDeleteExisting(video) : undefined}
            />
          ))}
          {videos.map((video, index) => (
            <VideoCard
              key={`${video.file.name}-${video.file.lastModified}-${index}`}
              src={video.previewUrl}
              poster={video.thumbnailUrl || undefined}
              onRemove={() => removeNewVideo(index)}
            />
          ))}
        </div>
      )}

      {canAddMore && (
        <label className="mt-6 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-surface)] px-5 text-center text-[var(--koluj-green)] transition hover:border-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]">
          <Plus size={32} />
          <span className="mt-2 font-black">{processing ? "Načítám videa..." : "Přidat video"}</span>
          <span className="mt-1 text-xs font-bold text-[var(--koluj-muted)]">
            MP4 nebo WebM · maximálně 60 s · do 75 MB · {totalCount}/{MAX_OFFER_VIDEOS}
          </span>
          <input
            type="file"
            accept="video/mp4,video/webm"
            multiple
            disabled={processing}
            onChange={(event) => {
              void handleVideos(event.target.files);
              event.currentTarget.value = "";
            }}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function VideoCard({ src, poster, onRemove }: { src: string; poster?: string; onRemove?: () => void }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[var(--koluj-border)] bg-black">
      <video src={src} poster={poster} controls playsInline preload="metadata" className="aspect-video w-full object-contain" />
      <div className="flex items-center justify-between gap-3 bg-[var(--koluj-surface)] p-4">
        <div>
          <p className="font-black">Video nabídky</p>
          <p className="mt-1 text-xs font-bold text-[var(--koluj-muted)]">MP4 nebo WebM · maximálně 60 s</p>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Odebrat video"
            className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700 transition hover:bg-red-100"
          >
            <Trash2 size={17} /> Odebrat
          </button>
        )}
      </div>
    </div>
  );
}

function revokeVideoUrls(video: SelectedOfferVideo) {
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
    // Náhled je nepovinný, video lze uložit i bez něj.
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
