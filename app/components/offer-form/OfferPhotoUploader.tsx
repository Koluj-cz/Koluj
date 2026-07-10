"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Plus, Star, X } from "lucide-react";
import toast from "react-hot-toast";
import SectionTitle from "@/app/components/SectionTitle";
import type { ExistingOfferPhoto } from "@/app/components/offer-form/types";

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
        <div className="mt-6 overflow-hidden rounded-[34px] bg-[var(--koluj-surface)] shadow-[0_18px_55px_rgba(31,31,26,0.10)]">
          <div className="relative flex h-[320px] items-center justify-center overflow-hidden bg-[var(--koluj-bg)] sm:h-[380px] md:h-[560px]">
            {selectedMain.kind === "existing" ? (
              <>
                <Image
                  src={selectedMain.src}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 1280px) 100vw, 70vw"
                  className="scale-110 object-cover opacity-35 blur-2xl"
                />
                <div className="absolute inset-0 bg-white/20" />
                <Image
                  src={selectedMain.src}
                  alt="Hlavní fotka nabídky"
                  fill
                  sizes="(max-width: 1280px) 100vw, 70vw"
                  className="relative z-10 object-contain p-5 md:p-8"
                />
              </>
            ) : (
              <>
                <img
                  src={selectedMain.src}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"
                />
                <div className="absolute inset-0 bg-white/20" />
                <img
                  src={selectedMain.src}
                  alt="Hlavní fotka nabídky"
                  className="relative z-10 h-full w-full object-contain p-5 md:p-8"
                />
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-3 border-t border-[var(--koluj-border)] bg-[var(--koluj-surface)] p-4">
            {items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => chooseMain(item)}
                className={`relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl border-2 transition ${
                  item.isPrimary
                    ? "border-[var(--koluj-green)]"
                    : "border-transparent opacity-75 hover:opacity-100"
                }`}
                aria-label={`Nastavit fotku ${index + 1} jako hlavní`}
              >
                {item.kind === "existing" ? (
                  <Image
                    src={item.src}
                    alt=""
                    width={144}
                    height={120}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={item.src}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}

                <span
                  className={`absolute left-1 top-1 rounded-full p-1.5 shadow-sm ${
                    item.isPrimary
                      ? "bg-white text-[var(--koluj-green)]"
                      : "bg-white/90 text-[var(--koluj-muted)]"
                  }`}
                >
                  <Star
                    size={14}
                    fill={item.isPrimary ? "currentColor" : "none"}
                  />
                </span>

                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (item.kind === "existing" && item.id && onDeleteExisting) {
                      void onDeleteExisting(item.id, item.src);
                    } else if (item.kind === "new") {
                      removeNewPhoto(item.index);
                    }
                  }}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1.5 text-red-500 shadow-sm"
                  aria-label="Odstranit fotku"
                  title="Odstranit fotku"
                >
                  <X size={14} />
                </span>
              </button>
            ))}

            {canAddMore && (
              <label className="flex h-20 w-24 shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-surface)] text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]">
                <Plus size={22} />
                <span className="mt-1 text-xs font-bold">Přidat</span>
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
      ) : (
        <label className="mt-6 flex h-48 cursor-pointer flex-col items-center justify-center rounded-[34px] border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-surface)] text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]">
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
