"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type GalleryImage = {
  id: string;
  kind?: "image";
  src: string;
  alt?: string;
};

export type GalleryVideo = {
  id: string;
  kind: "video";
  src: string;
  poster?: string | null;
  alt?: string;
};

export type GalleryMedia = GalleryImage | GalleryVideo;

type GalleryLightboxProps = {
  media?: GalleryMedia[];
  images?: GalleryImage[];
  activeIndex: number | null;
  onClose: () => void;
  onChange: (index: number) => void;
};

export default function GalleryLightbox({
  media,
  images,
  activeIndex,
  onClose,
  onChange,
}: GalleryLightboxProps) {
  const resolvedMedia: GalleryMedia[] =
    media ?? images?.map((image) => ({ ...image, kind: "image" as const })) ?? [];
  const isOpen = activeIndex !== null && resolvedMedia.length > 0;
  const currentIndex = activeIndex ?? 0;

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") {
        onChange((currentIndex - 1 + resolvedMedia.length) % resolvedMedia.length);
      }
      if (event.key === "ArrowRight") {
        onChange((currentIndex + 1) % resolvedMedia.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, isOpen, resolvedMedia.length, onChange, onClose]);

  if (!isOpen) return null;

  const currentMedia = resolvedMedia[currentIndex];
  const isVideo = currentMedia.kind === "video";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Galerie nabídky"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:right-7 md:top-7"
        aria-label="Zavřít galerii"
      >
        <X size={26} />
      </button>

      {resolvedMedia.length > 1 && (
        <>
          <button
            type="button"
            onClick={() =>
              onChange((currentIndex - 1 + resolvedMedia.length) % resolvedMedia.length)
            }
            className="absolute left-3 z-20 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:left-7"
            aria-label="Předchozí médium"
          >
            <ChevronLeft size={30} />
          </button>

          <button
            type="button"
            onClick={() => onChange((currentIndex + 1) % resolvedMedia.length)}
            className="absolute right-3 z-20 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:right-7"
            aria-label="Další médium"
          >
            <ChevronRight size={30} />
          </button>
        </>
      )}

      <div className="flex h-full w-full max-w-[1500px] flex-col items-center justify-center">
        {isVideo ? (
          <video
            key={currentMedia.id}
            src={currentMedia.src}
            poster={currentMedia.poster || undefined}
            controls
            playsInline
            preload="metadata"
            className="max-h-[calc(100vh-7rem)] max-w-full object-contain"
            aria-label={currentMedia.alt || `Video ${currentIndex + 1}`}
          />
        ) : (
          // Native img also supports local blob URLs used in the offer editor.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentMedia.src}
            alt={currentMedia.alt || `Fotografie ${currentIndex + 1}`}
            className="max-h-[calc(100vh-7rem)] max-w-full select-none object-contain"
            draggable={false}
          />
        )}

        <div className="mt-4 rounded-full bg-black/45 px-4 py-2 text-sm font-bold text-white">
          {currentIndex + 1} / {resolvedMedia.length}
        </div>
      </div>
    </div>
  );
}
