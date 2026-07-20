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
      <div className="flex h-72 items-center justify-center bg-[var(--koluj-bg)] text-sm font-bold text-[var(--koluj-muted)] md:h-[460px]">
        Bez fotky
      </div>
    );
  }

  const mobileImage = images[mobileIndex];

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
            className="object-cover"
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

      <div className="relative hidden h-[500px] gap-1.5 bg-[var(--koluj-bg)] p-1.5 md:grid md:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]">
        <GalleryTile
          image={visibleDesktopImages[0]}
          index={0}
          title={title}
          priority
          className="h-full"
          onOpen={setLightboxIndex}
        />

        <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-1.5">
          {visibleDesktopImages.slice(1, 5).map((image, offset) => {
            const index = offset + 1;
            const remainingCount = images.length - 5;
            const isLastVisible = index === 4 && remainingCount > 0;

            return (
              <GalleryTile
                key={image.id}
                image={image}
                index={index}
                title={title}
                className="h-full min-h-0"
                overlayLabel={isLastVisible ? `+ ${remainingCount} dalších` : undefined}
                onOpen={setLightboxIndex}
              />
            );
          })}

          {Array.from({ length: Math.max(0, 4 - (visibleDesktopImages.length - 1)) }).map(
            (_, index) => (
              <div
                key={`empty-${index}`}
                className="flex items-center justify-center bg-white/45 text-[var(--koluj-muted)]"
              >
                <Camera size={24} />
              </div>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[var(--koluj-text)] shadow-lg transition hover:-translate-y-0.5"
        >
          <Camera size={18} />
          Zobrazit všech {images.length} fotek
        </button>
      </div>

      <GalleryLightbox
        images={images}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChange={setLightboxIndex}
      />
    </>
  );
}

type GalleryTileProps = {
  image: GalleryImage;
  index: number;
  title: string;
  className?: string;
  priority?: boolean;
  overlayLabel?: string;
  onOpen: (index: number) => void;
};

function GalleryTile({
  image,
  index,
  title,
  className = "",
  priority = false,
  overlayLabel,
  onOpen,
}: GalleryTileProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={`group relative overflow-hidden bg-white ${className}`}
      aria-label={`Zvětšit fotografii ${index + 1}`}
    >
      <Image
        src={image.src}
        alt={image.alt || title}
        fill
        priority={priority}
        sizes={index === 0 ? "(max-width: 1280px) 65vw, 760px" : "320px"}
        className="object-cover transition duration-300 group-hover:scale-[1.025]"
      />

      {overlayLabel && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 px-4 text-center text-lg font-black text-white">
          {overlayLabel}
        </span>
      )}
    </button>
  );
}
