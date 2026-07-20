"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Maximize2, Plus, Star, X } from "lucide-react";
import toast from "react-hot-toast";
import SectionTitle from "@/app/components/SectionTitle";
import type { ExistingOfferPhoto } from "@/app/components/offer-form/types";
import GalleryLightbox from "@/app/components/offer-gallery/GalleryLightbox";

type OfferPhotoUploaderProps = {
  offerType: string;
  existingImages?: ExistingOfferPhoto[];
  primaryImageUrl?: string;
  photos: File[];
  setPhotos: React.Dispatch<React.SetStateAction<File[]>>;
  photoPreviews: string[];
  setPhotoPreviews: React.Dispatch<React.SetStateAction<string[]>>;
  mainPhotoIndex: number;
  setMainPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  onMakePrimaryExisting?: (imageUrl: string) => void | Promise<void>;
  onDeleteExisting?: (imageId: string, imageUrl: string) => void | Promise<void>;
  maxPhotos?: number;
};

type PhotoItem = {
  key: string;
  src: string;
  kind: "existing" | "new";
  index: number;
  id?: string;
  isPrimary: boolean;
};

export default function OfferPhotoUploader({
  offerType,
  existingImages = [],
  primaryImageUrl = "",
  photos,
  setPhotos,
  photoPreviews,
  setPhotoPreviews,
  mainPhotoIndex,
  setMainPhotoIndex,
  onMakePrimaryExisting,
  onDeleteExisting,
  maxPhotos = 8,
}: OfferPhotoUploaderProps) {
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photoPreviewsRef = useRef<string[]>([]);

  const totalPhotos = existingImages.length + photos.length;
  const canAddMore = totalPhotos < maxPhotos;

  const items = useMemo<PhotoItem[]>(() => {
    const existing = existingImages.map((image, index) => ({
      key: image.id,
      src: image.image_url,
      kind: "existing" as const,
      index,
      id: image.id,
      isPrimary: mainPhotoIndex < 0 && primaryImageUrl === image.image_url,
    }));

    const newlyAdded = photoPreviews.map((preview, index) => ({
      key: preview,
      src: preview,
      kind: "new" as const,
      index,
      isPrimary: mainPhotoIndex === index,
    }));

    return [...existing, ...newlyAdded];
  }, [existingImages, mainPhotoIndex, photoPreviews, primaryImageUrl]);

  const selectedMain =
    items.find((item) => item.isPrimary) ?? items[0] ?? null;

  useEffect(() => {
    photoPreviewsRef.current = photoPreviews;
  }, [photoPreviews]);

  useEffect(() => {
    return () => {
      photoPreviewsRef.current.forEach((preview) =>
        URL.revokeObjectURL(preview),
      );
    };
  }, []);

  async function handlePhotos(files: FileList | null) {
    if (!files) return;

    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;

    if (totalPhotos + selectedFiles.length > maxPhotos) {
      toast.error(`Můžeš nahrát maximálně ${maxPhotos} fotek`);
      return;
    }

    const oversized = selectedFiles.find(
      (file) => file.size > 15 * 1024 * 1024,
    );

    if (oversized) {
      toast.error("Jedna z fotek je větší než 15 MB");
      return;
    }

    setUploadingPhotos(true);
    setUploadProgress(10);

    try {
      const imageCompression = (
        await import("browser-image-compression")
      ).default;

      const compressedFiles = await Promise.all(
        selectedFiles.map((file) =>
          imageCompression(file, {
            maxSizeMB: 0.7,
            maxWidthOrHeight: 1400,
            useWebWorker: true,
            fileType: "image/webp",
          }),
        ),
      );

      const previewUrls = compressedFiles.map((file) =>
        URL.createObjectURL(file),
      );

      setPhotos((current) => {
        if (existingImages.length === 0 && current.length === 0) {
          setMainPhotoIndex(0);
        }
        return [...current, ...compressedFiles];
      });

      setPhotoPreviews((current) => [...current, ...previewUrls]);
      setUploadProgress(100);
    } catch {
      toast.error("Fotku se nepodařilo zpracovat");
      setUploadProgress(0);
    } finally {
      setUploadingPhotos(false);
    }
  }

  function removeNewPhoto(index: number) {
    const preview = photoPreviews[index];
    if (preview) URL.revokeObjectURL(preview);

    setPhotos((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );

    setPhotoPreviews((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );

    setMainPhotoIndex((current) => {
      if (current === index) {
        return existingImages.length > 0 ? -1 : 0;
      }
      if (current > index) return current - 1;
      return current;
    });
  }

  function chooseMain(item: PhotoItem) {
    if (item.kind === "new") {
      setMainPhotoIndex(item.index);
      return;
    }

    setMainPhotoIndex(-1);
    if (onMakePrimaryExisting) {
      void onMakePrimaryExisting(item.src);
    }
  }

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle
        icon={<Camera size={24} />}
        title={offerType === "service" ? "Fotky služby" : "Fotky věci"}
      />

      {selectedMain ? (
        <div className="mt-6 overflow-hidden rounded-[28px] border border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-2 shadow-[0_14px_42px_rgba(31,31,26,0.08)]">
          <div className="grid min-h-[300px] gap-2 md:h-[420px] md:grid-cols-[minmax(0,1.55fr)_minmax(220px,1fr)]">
            <PhotoTile
              item={selectedMain}
              itemIndex={items.indexOf(selectedMain)}
              isLarge
              onChooseMain={chooseMain}
              onOpen={setLightboxIndex}
              onRemove={(item) => {
                if (item.kind === "existing" && item.id && onDeleteExisting) {
                  void onDeleteExisting(item.id, item.src);
                } else if (item.kind === "new") {
                  removeNewPhoto(item.index);
                }
              }}
            />

            <div className="grid grid-cols-2 gap-2">
              {items
                .filter((item) => item.key !== selectedMain.key)
                .slice(0, 3)
                .map((item) => (
                  <PhotoTile
                    key={item.key}
                    item={item}
                    itemIndex={items.indexOf(item)}
                    onChooseMain={chooseMain}
                    onOpen={setLightboxIndex}
                    onRemove={(photoItem) => {
                      if (
                        photoItem.kind === "existing" &&
                        photoItem.id &&
                        onDeleteExisting
                      ) {
                        void onDeleteExisting(photoItem.id, photoItem.src);
                      } else if (photoItem.kind === "new") {
                        removeNewPhoto(photoItem.index);
                      }
                    }}
                  />
                ))}

              {canAddMore && (
                <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-surface)] text-[var(--koluj-green)] transition hover:bg-white">
                  <Plus size={24} />
                  <span className="mt-1 text-xs font-black">Přidat fotky</span>
                  <span className="mt-1 text-[11px] font-bold text-[var(--koluj-muted)]">
                    {totalPhotos}/{maxPhotos}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(event) => {
                      void handlePhotos(event.target.files);
                      event.currentTarget.value = "";
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {items.length > 4 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {items.slice(4).map((item) => {
                const itemIndex = items.indexOf(item);

                return (
                  <div
                    key={item.key}
                    className="relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-white"
                  >
                    <PhotoPreview item={item} />
                    <button
                      type="button"
                      onClick={() => chooseMain(item)}
                      className="absolute inset-0 bg-black/10 transition hover:bg-black/20"
                      aria-label="Nastavit fotografii jako hlavní"
                    />
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(itemIndex)}
                      className="absolute left-1 top-1 rounded-full bg-white/95 p-1.5 shadow"
                      aria-label="Zvětšit fotografii"
                    >
                      <Maximize2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.kind === "existing" && item.id && onDeleteExisting) {
                          void onDeleteExisting(item.id, item.src);
                        } else if (item.kind === "new") {
                          removeNewPhoto(item.index);
                        }
                      }}
                      className="absolute right-1 top-1 rounded-full bg-white/95 p-1.5 text-red-500 shadow"
                      aria-label="Odstranit fotografii"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <label className="mt-6 flex h-48 cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-surface)] text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]">
          <Plus size={34} />
          <span className="mt-2 text-sm font-bold">Přidat fotku</span>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(event) => {
              void handlePhotos(event.target.files);
              event.currentTarget.value = "";
            }}
            className="hidden"
          />
        </label>
      )}

      <GalleryLightbox
        images={items.map((item, index) => ({
          id: item.key,
          src: item.src,
          alt: `Fotografie nabídky ${index + 1}`,
        }))}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChange={setLightboxIndex}
      />

      <p className="mt-4 text-sm text-[var(--koluj-muted)]">
        {offerType === "service"
          ? "Fotky jsou u služby volitelné. Pomůžou ale zvýšit důvěryhodnost nabídky."
          : "Nahraj 1–8 fotek. Kliknutím na miniaturu vybereš hlavní fotku."}
      </p>

      {uploadingPhotos && (
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-sm font-bold text-[var(--koluj-muted)]">
            <span>Zpracovávám fotky...</span>
            <span>{uploadProgress}%</span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-[var(--koluj-bg)]">
            <div
              className="h-full rounded-full bg-[var(--koluj-green)]"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

type PhotoTileProps = {
  item: PhotoItem;
  itemIndex: number;
  isLarge?: boolean;
  onChooseMain: (item: PhotoItem) => void;
  onOpen: (index: number) => void;
  onRemove: (item: PhotoItem) => void;
};

function PhotoTile({
  item,
  itemIndex,
  isLarge = false,
  onChooseMain,
  onOpen,
  onRemove,
}: PhotoTileProps) {
  return (
    <div
      className={`group relative min-h-36 overflow-hidden rounded-2xl bg-white ${
        isLarge ? "row-span-2 md:h-full" : ""
      }`}
    >
      <PhotoPreview item={item} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10 opacity-80" />

      <button
        type="button"
        onClick={() => onChooseMain(item)}
        className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black shadow-lg transition ${
          item.isPrimary
            ? "bg-[var(--koluj-green)] text-white"
            : "bg-white/95 text-[var(--koluj-text)] hover:-translate-y-0.5"
        }`}
      >
        <Star size={14} fill={item.isPrimary ? "currentColor" : "none"} />
        {item.isPrimary ? "Hlavní" : "Nastavit hlavní"}
      </button>

      <div className="absolute right-3 top-3 flex gap-2">
        <button
          type="button"
          onClick={() => onOpen(itemIndex)}
          className="rounded-full bg-white/95 p-2 text-[var(--koluj-text)] shadow-lg transition hover:scale-105"
          aria-label="Zvětšit fotografii"
        >
          <Maximize2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(item)}
          className="rounded-full bg-white/95 p-2 text-red-500 shadow-lg transition hover:scale-105"
          aria-label="Odstranit fotografii"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function PhotoPreview({ item }: { item: PhotoItem }) {
  if (item.kind === "existing") {
    return (
      <Image
        src={item.src}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 560px"
        className="object-cover"
      />
    );
  }

  return (
    // Object URL preview; Next image optimization is not applicable.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.src} alt="" className="h-full w-full object-cover" />
  );
}

