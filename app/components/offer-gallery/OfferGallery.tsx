"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Play } from "lucide-react";
import GalleryLightbox, {
  type GalleryImage,
  type GalleryMedia,
  type GalleryVideo,
} from "./GalleryLightbox";

type OfferGalleryProps = {
  images: GalleryImage[];
  videos?: GalleryVideo[];
  title: string;
};

export default function OfferGallery({
  images,
  videos = [],
  title,
}: OfferGalleryProps) {
  const media = useMemo<GalleryMedia[]>(
    () => [
      ...images.map((image) => ({ ...image, kind: "image" as const })),
      ...videos,
    ],
    [images, videos],
  );
  const [mobileIndex, setMobileIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function changeMobileMedia(direction: -1 | 1) {
    setMobileIndex((current) =>
      (current + direction + media.length) % media.length,
    );
  }

  const visibleDesktopMedia = useMemo(() => media.slice(0, 5), [media]);

  if (media.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center bg-[var(--koluj-bg)] text-sm font-bold text-[var(--koluj-muted)] md:h-[500px]">
        Bez fotky
      </div>
    );
  }

  const mobileMedia = media[mobileIndex];
  const hasSingleMedia = media.length === 1;

  return (
    <>
      <div
        className="relative touch-pan-y md:hidden"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const touch = event.changedTouches[0];
          touchStart.current = null;

          if (!start || media.length < 2) return;

          const deltaX = touch.clientX - start.x;
          const deltaY = touch.clientY - start.y;

          if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) {
            return;
          }

          changeMobileMedia(deltaX < 0 ? 1 : -1);
        }}
      >
        {mobileMedia.kind === "video" ? (
          <div className="relative h-[330px] w-full overflow-hidden bg-black">
            <video
              key={mobileMedia.id}
              src={mobileMedia.src}
              poster={mobileMedia.poster || undefined}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
              aria-label={mobileMedia.alt || title}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLightboxIndex(mobileIndex)}
            className="relative block h-[330px] w-full overflow-hidden bg-[var(--koluj-bg)]"
            aria-label={`Zvětšit fotografii ${mobileIndex + 1}`}
          >
            <Image
              src={mobileMedia.src}
              alt={mobileMedia.alt || title}
              fill
              priority={mobileIndex === 0}
              sizes="100vw"
              className={hasSingleMedia ? "object-contain" : "object-cover"}
            />
          </button>
        )}

        {media.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => changeMobileMedia(-1)}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-[var(--koluj-text)] shadow-lg"
              aria-label="Předchozí médium"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => changeMobileMedia(1)}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-[var(--koluj-text)] shadow-lg"
              aria-label="Další médium"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        <span className="absolute bottom-3 right-3 z-10 rounded-full bg-black/65 px-3 py-1.5 text-xs font-black text-white">
          {mobileIndex + 1} / {media.length}
        </span>
      </div>

      <DesktopGallery
        media={visibleDesktopMedia}
        totalMedia={media.length}
        imageCount={images.length}
        videoCount={videos.length}
        title={title}
        onOpen={setLightboxIndex}
      />

      <GalleryLightbox
        media={media}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChange={setLightboxIndex}
      />
    </>
  );
}

type DesktopGalleryProps = {
  media: GalleryMedia[];
  totalMedia: number;
  imageCount: number;
  videoCount: number;
  title: string;
  onOpen: (index: number) => void;
};

function DesktopGallery({
  media,
  totalMedia,
  imageCount,
  videoCount,
  title,
  onOpen,
}: DesktopGalleryProps) {
  const count = media.length;
  const remainingCount = Math.max(0, totalMedia - 5);

  if (count === 1) {
    return (
      <div className="relative hidden h-[500px] overflow-hidden bg-[var(--koluj-bg)] md:block">
        <GalleryTile
          media={media[0]}
          index={0}
          title={title}
          priority
          fit="contain"
          className="h-full w-full"
          onOpen={onOpen}
        />
        <GalleryCountButton
          imageCount={imageCount}
          videoCount={videoCount}
          onClick={() => onOpen(0)}
        />
      </div>
    );
  }

  return (
    <div className="relative hidden h-[500px] overflow-hidden bg-[var(--koluj-bg)] md:grid md:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)] md:gap-1">
      <GalleryTile
        media={media[0]}
        index={0}
        title={title}
        priority
        className="h-full min-h-0"
        onOpen={onOpen}
      />

      <DesktopThumbnailGrid
        media={media.slice(1)}
        totalMedia={totalMedia}
        remainingCount={remainingCount}
        title={title}
        onOpen={onOpen}
      />

      <GalleryCountButton
        imageCount={imageCount}
        videoCount={videoCount}
        onClick={() => onOpen(0)}
      />
    </div>
  );
}

type DesktopThumbnailGridProps = {
  media: GalleryMedia[];
  totalMedia: number;
  remainingCount: number;
  title: string;
  onOpen: (index: number) => void;
};

function DesktopThumbnailGrid({
  media,
  totalMedia,
  remainingCount,
  title,
  onOpen,
}: DesktopThumbnailGridProps) {
  return (
    <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-1">
      {media.slice(0, 4).map((item, offset) => {
        const index = offset + 1;
        const isLastVisible = offset === 3 && totalMedia > 5;

        return (
          <GalleryTile
            key={`${item.kind || "image"}-${item.id}`}
            media={item}
            index={index}
            title={title}
            className="h-full min-h-0"
            overlayLabel={
              isLastVisible && remainingCount > 0
                ? `+ ${remainingCount} dalších`
                : undefined
            }
            onOpen={onOpen}
          />
        );
      })}
    </div>
  );
}

function GalleryCountButton({
  imageCount,
  videoCount,
  onClick,
}: {
  imageCount: number;
  videoCount: number;
  onClick: () => void;
}) {
  const label =
    videoCount > 0
      ? `${imageCount} ${imageCount === 1 ? "fotka" : imageCount < 5 ? "fotky" : "fotek"} a ${videoCount} ${videoCount === 1 ? "video" : "videa"}`
      : imageCount === 1
        ? "fotku"
        : `všech ${imageCount} fotek`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-[var(--koluj-text)] shadow-lg transition hover:-translate-y-0.5"
    >
      <Camera size={18} />
      Zobrazit {label}
    </button>
  );
}

type GalleryTileProps = {
  media: GalleryMedia;
  index: number;
  title: string;
  className?: string;
  priority?: boolean;
  overlayLabel?: string;
  fit?: "cover" | "contain";
  onOpen: (index: number) => void;
};

function GalleryTile({
  media,
  index,
  title,
  className = "",
  priority = false,
  overlayLabel,
  fit = "cover",
  onOpen,
}: GalleryTileProps) {
  const isVideo = media.kind === "video";

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={`group relative overflow-hidden bg-[var(--koluj-bg)] ${className}`}
      aria-label={isVideo ? `Přehrát video ${index + 1}` : `Zvětšit fotografii ${index + 1}`}
    >
      {isVideo ? (
        <>
          {media.poster ? (
            <Image
              src={media.poster}
              alt={media.alt || title}
              fill
              sizes="360px"
              className="object-cover transition duration-300 group-hover:scale-[1.015]"
            />
          ) : (
            <video
              src={media.src}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[var(--koluj-ink)] shadow-lg">
              <Play size={26} fill="currentColor" className="ml-1" />
            </span>
          </span>
        </>
      ) : (
        <Image
          src={media.src}
          alt={media.alt || title}
          fill
          priority={priority}
          sizes={index === 0 ? "(max-width: 1280px) 55vw, 900px" : "360px"}
          className={`${fit === "contain" ? "object-contain" : "object-cover"} transition duration-300 group-hover:scale-[1.015]`}
        />
      )}

      {overlayLabel && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 px-4 text-center text-lg font-black text-white">
          {overlayLabel}
        </span>
      )}
    </button>
  );
}
