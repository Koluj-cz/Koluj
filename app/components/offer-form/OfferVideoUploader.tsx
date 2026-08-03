"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import SectionTitle from "@/app/components/SectionTitle";
import MediaDropzone from "@/app/components/offer-form/MediaDropzone";
import MediaProgress from "@/app/components/offer-form/MediaProgress";
import type { ExistingOfferVideo } from "@/app/components/offer-form/types";
import {
  prepareBrowserVideo,
  revokePreparedVideoUrls,
  type PreparedBrowserVideo,
} from "@/lib/mediaUpload";
import {
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEO_SIZE_MB,
} from "@/lib/mediaLimits";

export const MAX_OFFER_VIDEOS = 3;
export type SelectedOfferVideo = PreparedBrowserVideo;

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
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Připravuji video...");
  const currentVideosRef = useRef<SelectedOfferVideo[]>([]);
  const totalCount = existingVideos.length + videos.length;
  const canAddMore = totalCount < MAX_OFFER_VIDEOS;

  useEffect(() => {
    currentVideosRef.current = videos;
  }, [videos]);

  useEffect(() => {
    return () => currentVideosRef.current.forEach(revokePreparedVideoUrls);
  }, []);

  async function handleVideos(files: FileList | null) {
    if (!files?.length) return;

    const remainingSlots = MAX_OFFER_VIDEOS - totalCount;
    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast.error(`K nabídce můžeš přidat maximálně ${MAX_OFFER_VIDEOS} videa`);
    }

    setProcessing(true);
    setProgress(0);
    const preparedVideos: SelectedOfferVideo[] = [];

    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        const baseProgress = (index / Math.max(selectedFiles.length, 1)) * 100;
        setProgressLabel("Připravuji video...");
        setProgress(baseProgress + 5);

        if (!["video/mp4", "video/webm"].includes(file.type)) {
          toast.error(`${file.name}: podporujeme pouze MP4 nebo WebM`);
          continue;
        }

        if (file.size > MAX_VIDEO_SIZE_BYTES) {
          toast.error(`${file.name}: video může mít maximálně ${MAX_VIDEO_SIZE_MB} MB`);
          continue;
        }

        try {
          setProgress(baseProgress + 20 / selectedFiles.length);
          const selected = await prepareBrowserVideo(file, (stageProgress) => {
            const fileShare = 100 / Math.max(selectedFiles.length, 1);
            setProgress(baseProgress + (stageProgress / 100) * fileShare);
            setProgressLabel("Připravuji video...");
          });

          if (selected.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
            revokePreparedVideoUrls(selected);
            toast.error(`${file.name}: video může mít maximálně ${MAX_VIDEO_DURATION_SECONDS} sekund`);
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
      setProgress(100);
      setProgressLabel("Video je připravené");
    } finally {
      window.setTimeout(() => {
        setProcessing(false);
        setProgress(0);
      }, 350);
    }
  }

  function removeNewVideo(index: number) {
    setVideos((current) => {
      const selected = current[index];
      if (selected) revokePreparedVideoUrls(selected);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle icon={<Film size={24} />} title="Videa" />

      <p className="mt-4 text-sm leading-relaxed text-[var(--koluj-muted)]">
        Přidej až {MAX_OFFER_VIDEOS} krátká videa. MP4 nebo WebM, maximálně {MAX_VIDEO_DURATION_SECONDS} sekund a {MAX_VIDEO_SIZE_MB} MB.
      </p>

      {(existingVideos.length > 0 || videos.length > 0) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {existingVideos.map((video) => (
            <article key={video.id} className="relative overflow-hidden rounded-2xl bg-black">
              <video
                src={video.video_url}
                poster={video.thumbnail_url || undefined}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full object-contain"
              />
              {onDeleteExisting && (
                <button
                  type="button"
                  onClick={() => onDeleteExisting(video)}
                  className="absolute right-2 top-2 rounded-full bg-white/95 p-2 text-red-600 shadow-lg transition hover:scale-105"
                  aria-label="Smazat video"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </article>
          ))}

          {videos.map((video, index) => (
            <article key={`${video.file.name}-${video.file.lastModified}-${index}`} className="relative overflow-hidden rounded-2xl bg-black">
              <video
                src={video.previewUrl}
                poster={video.thumbnailUrl || undefined}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full object-contain"
              />
              <button
                type="button"
                onClick={() => removeNewVideo(index)}
                className="absolute right-2 top-2 rounded-full bg-white/95 p-2 text-red-600 shadow-lg transition hover:scale-105"
                aria-label="Odebrat video"
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      )}

      {canAddMore && (
        <MediaDropzone
          accept="video/mp4,video/webm"
          multiple
          disabled={processing}
          onFiles={handleVideos}
          className="mt-6 min-h-40 px-5 py-7"
        >
          <Plus size={34} className="transition group-hover:scale-105" />
          <span className="mt-2 text-sm font-black">Přidat video</span>
          <span className="mt-1 text-xs font-bold text-[var(--koluj-muted)]">
            {totalCount}/{MAX_OFFER_VIDEOS} · max. {MAX_VIDEO_SIZE_MB} MB
          </span>
        </MediaDropzone>
      )}

      {processing && <MediaProgress label={progressLabel} value={progress} />}
    </div>
  );
}
