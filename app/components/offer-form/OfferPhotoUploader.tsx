"use client";

import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    photoPreviewsRef.current = photoPreviews;
  }, [photoPreviews]);

  useEffect(() => {
    return () => {
      photoPreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
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

    const oversized = selectedFiles.find((file) => file.size > 15 * 1024 * 1024);

    if (oversized) {
      toast.error("Jedna z fotek je větší než 15 MB");
      return;
    }

    setUploadingPhotos(true);
    setUploadProgress(10);

    try {
      const imageCompression = (await import("browser-image-compression")).default;

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

      setUploadProgress(100);
      setUploadingPhotos(false);

      setPhotos((currentPhotos) => {
        const nextPhotos = [...currentPhotos, ...compressedFiles];

        if (existingImages.length === 0 && currentPhotos.length === 0) {
          setMainPhotoIndex(0);
        }

        return nextPhotos;
      });

      setPhotoPreviews((currentPreviews) => [
        ...currentPreviews,
        ...compressedFiles.map((file) => URL.createObjectURL(file)),
      ]);
    } catch {
      toast.error("Fotku se nepodařilo zpracovat");
      setUploadingPhotos(false);
      setUploadProgress(0);
    }
  }

  function removeNewPhoto(index: number) {
    const previewToRevoke = photoPreviews[index];

    if (previewToRevoke) {
      URL.revokeObjectURL(previewToRevoke);
    }

    setPhotos((currentPhotos) =>
      currentPhotos.filter((_, currentIndex) => currentIndex !== index),
    );

    setPhotoPreviews((currentPreviews) =>
      currentPreviews.filter((_, currentIndex) => currentIndex !== index),
    );

    setMainPhotoIndex((currentIndex) => {
      if (currentIndex === index) return existingImages.length > 0 ? -1 : 0;
      if (currentIndex > index) return currentIndex - 1;
      return currentIndex;
    });
  }

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle
        icon={<Camera size={24} />}
        title={offerType === "service" ? "Fotky služby" : "Fotky věci"}
      />

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {existingImages.map((image) => (
          <div
            key={image.id}
            className="relative overflow-hidden rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)]"
          >
            <img src={image.image_url} alt="Fotka nabídky" className="h-36 w-full object-cover" />

            {onMakePrimaryExisting && (
              <button
                type="button"
                onClick={() => onMakePrimaryExisting(image.image_url)}
                className={`absolute left-2 top-2 rounded-full p-2 shadow-sm ${
                  primaryImageUrl === image.image_url
                    ? "bg-white text-[var(--koluj-green)]"
                    : "bg-white text-[var(--koluj-muted)]"
                }`}
                aria-label="Nastavit jako hlavní fotku"
                title="Nastavit jako hlavní fotku"
              >
                <Star
                  size={18}
                  fill={primaryImageUrl === image.image_url ? "currentColor" : "none"}
                />
              </button>
            )}

            {onDeleteExisting && (
              <button
                type="button"
                onClick={() => onDeleteExisting(image.id, image.image_url)}
                className="absolute right-2 top-2 rounded-full bg-white p-2 text-red-500 shadow-sm"
                aria-label="Smazat fotku"
                title="Smazat fotku"
              >
                <X size={18} />
              </button>
            )}

            {primaryImageUrl === image.image_url && (
              <div className="absolute bottom-2 left-2 rounded-full bg-[var(--koluj-green)] px-3 py-1 text-xs font-bold text-white">
                Hlavní
              </div>
            )}
          </div>
        ))}

        {photoPreviews.map((preview, index) => (
          <div
            key={preview}
            className="relative overflow-hidden rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)]"
          >
            <img src={preview} alt="Náhled nové fotky" className="h-36 w-full object-cover" />

            <button
              type="button"
              onClick={() => setMainPhotoIndex(index)}
              className={`absolute left-2 top-2 rounded-full p-2 shadow-sm ${
                mainPhotoIndex === index
                  ? "bg-white text-[var(--koluj-green)]"
                  : "bg-white text-[var(--koluj-muted)]"
              }`}
              aria-label="Nastavit jako hlavní fotku"
              title="Nastavit jako hlavní fotku"
            >
              <Star size={18} fill={mainPhotoIndex === index ? "currentColor" : "none"} />
            </button>

            <button
              type="button"
              onClick={() => removeNewPhoto(index)}
              className="absolute right-2 top-2 rounded-full bg-white p-2 text-red-500 shadow-sm"
              aria-label="Odebrat novou fotku"
              title="Odebrat novou fotku"
            >
              <X size={18} />
            </button>

            {mainPhotoIndex === index && (
              <div className="absolute bottom-2 left-2 rounded-full bg-[var(--koluj-green)] px-3 py-1 text-xs font-bold text-white">
                {existingImages.length > 0 ? "Hlavní po uložení" : "Hlavní"}
              </div>
            )}
          </div>
        ))}

        {canAddMore && (
          <label className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-surface)] text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]">
            <Plus size={30} />
            <span className="mt-2 text-sm font-bold">Přidat</span>

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

      <p className="mt-4 text-sm text-[var(--koluj-muted)]">
        {offerType === "service"
          ? "Fotky jsou u služby volitelné. Pomůžou ale zvýšit důvěryhodnost nabídky."
          : "Nahraj 1–8 fotek. Hvězdičkou označ hlavní fotku pro náhled."}
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
