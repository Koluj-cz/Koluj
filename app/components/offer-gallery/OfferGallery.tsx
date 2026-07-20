"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import GalleryLightbox, { type GalleryImage } from "./GalleryLightbox";

type OfferGalleryProps = {
  images: GalleryImage[];
  title: string;
};

export default function OfferGallery({ images, title }: OfferGalleryProps) {
  const [mobileIndex, setMobileIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visibleDesktopImages = useMemo(() => images.slice(0, 5), [images]);

  if (images.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center bg-[var(--koluj-bg)] text-sm font-bold text-[var(--koluj-muted)] md:h-[500px]">
        Bez fotky
      </div>
    );
  }

  const mobileImage = images[mobileIndex];
  const hasSingleImage = images.length === 1;

  return (
    <>
      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setLightboxIndex(mobileIndex)}
          className="relative block h-[330px] w-full overflow-hidden bg-[var(--koluj-bg)]"
          aria-label={`Zvětšit fotografii ${mobileIndex + 1}`}
        >
          <Image
            src={mobileImage.src}
            alt={mobileImage.alt || title}
            fill
            priority={mobileIndex === 0}
            sizes="100vw"
            className={hasSingleImage ? "object-contain" : "object-cover"}
          />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setMobileIndex((mobileIndex - 1 + images.length) % images.length)
              }
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-[var(--koluj-text)] shadow-lg"
              aria-label="Předchozí fotografie"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => setMobileIndex((mobileIndex + 1) % images.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-[var(--koluj-text)] shadow-lg"
              aria-label="Další fotografie"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1.5 text-xs font-black text-white">
          {mobileIndex + 1} / {images.length}
        </span>
      </div>

      <DesktopGallery
        images={visibleDesktopImages}
        totalImages={images.length}
        title={title}
        onOpen={setLightboxIndex}
      />

      <GalleryLightbox
        images={images}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChange={setLightboxIndex}
      />
    </>
  );
}

type DesktopGalleryProps = {
  images: GalleryImage[];
  totalImages: number;
  title: string;
  onOpen: (index: number) => void;
};

function DesktopGallery({
  images,
  totalImages,
  title,
  onOpen,
}: DesktopGalleryProps) {
  const count = images.length;
  const remainingCount = Math.max(0, totalImages - 5);

  if (count === 1) {
    return (
      <div className="relative hidden h-[500px] overflow-hidden bg-[var(--koluj-bg)] md:block">
        <GalleryTile
          image={images[0]}
          index={0}
          title={title}
          priority
          fit="contain"
          className="h-full w-full"
          onOpen={onOpen}
        />
        <GalleryCountButton count={totalImages} onClick={() => onOpen(0)} />
      </div>
    );
  }

  return (
    <div className="relative hidden h-[500px] overflow-hidden bg-[var(--koluj-bg)] md:grid md:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)] md:gap-1">
      <GalleryTile
        image={images[0]}
        index={0}
        title={title}
        priority
        className="h-full min-h-0"
        onOpen={onOpen}
      />

      <DesktopThumbnailGrid
        images={images.slice(1)}
        totalImages={totalImages}
        remainingCount={remainingCount}
        title={title}
        onOpen={onOpen}
      />

      <GalleryCountButton count={totalImages} onClick={() => onOpen(0)} />
    </div>
  );
}

type DesktopThumbnailGridProps = {
  images: GalleryImage[];
  totalImages: number;
  remainingCount: number;
  title: string;
  onOpen: (index: number) => void;
};

function DesktopThumbnailGrid({
  images,
  totalImages,
  remainingCount,
  title,
  onOpen,
}: DesktopThumbnailGridProps) {
  return (
    <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-1">
      {images.slice(0, 4).map((image, offset) => {
        const index = offset + 1;
        const isLastVisible = offset === 3 && totalImages > 5;

        return (
          <GalleryTile
            key={image.id}
            image={image}
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

function GalleryCountButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[var(--koluj-text)] shadow-lg transition hover:-translate-y-0.5"
    >
      <Camera size={18} />
      Zobrazit {count === 1 ? "fotku" : `všech ${count} fotek`}
    </button>
  );
}

type GalleryTileProps = {
  image: GalleryImage;
  index: number;
  title: string;
  className?: string;
  priority?: boolean;
  overlayLabel?: string;
  fit?: "cover" | "contain";
  onOpen: (index: number) => void;
};

function GalleryTile({
  image,
  index,
  title,
  className = "",
  priority = false,
  overlayLabel,
  fit = "cover",
  onOpen,
}: GalleryTileProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={`group relative overflow-hidden bg-[var(--koluj-bg)] ${className}`}
      aria-label={`Zvětšit fotografii ${index + 1}`}
    >
      <Image
        src={image.src}
        alt={image.alt || title}
        fill
        priority={priority}
        sizes={index === 0 ? "(max-width: 1280px) 55vw, 900px" : "360px"}
        className={`${fit === "contain" ? "object-contain" : "object-cover"} transition duration-300 group-hover:scale-[1.015]`}
      />

      {overlayLabel && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 px-4 text-center text-lg font-black text-white">
          {overlayLabel}
        </span>
      )}
    </button>
  );
}
