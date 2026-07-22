"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import BackLink from "@/app/components/BackLink";
import ConfirmLeaveDialog from "@/app/components/ConfirmLeaveDialog";
import PageLoader from "@/app/components/PageLoader";
import AvailabilityInfoSection from "@/app/components/offer-form/AvailabilityInfoSection";
import BasicInfoSection from "@/app/components/offer-form/BasicInfoSection";
import LocationSection from "@/app/components/offer-form/LocationSection";
import MobileSubmitButton from "@/app/components/offer-form/MobileSubmitButton";
import OfferFormSidebar from "@/app/components/offer-form/OfferFormSidebar";
import OfferPhotoUploader from "@/app/components/offer-form/OfferPhotoUploader";
import OfferVideoUploader, { type SelectedOfferVideo } from "@/app/components/offer-form/OfferVideoUploader";
import OfferTypeSection from "@/app/components/offer-form/OfferTypeSection";
import PriceSection from "@/app/components/offer-form/PriceSection";
import ServiceBookingSettingsSection from "@/app/components/offer-form/ServiceBookingSettingsSection";
import ServiceRealizationsEditor, { type ExistingServiceRealization } from "@/app/components/offer-form/ServiceRealizationsEditor";
import type {
  ExistingOfferPhoto,
  ExistingOfferVideo,
  OfferFormState,
} from "@/app/components/offer-form/types";
import { itemPriceUnits, servicePriceUnits } from "@/lib/constants";
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning";
import { uploadOfferVideo } from "@/lib/uploadOfferVideo";
import { uploadServiceRealization, type ServiceRealizationDraft } from "@/lib/uploadServiceRealization";

const emptyForm: OfferFormState = {
  offer_type: "item",
  title: "",
  description: "",
  category: "",
  condition: "",
  price_amount: "",
  price_unit: "day",
  price_note: "",
  deposit: "",
  pickup_place: "",
  pickup_latitude: null,
  pickup_longitude: null,
  handover_options: [],
  contact_note: "",
  service_booking_mode: "scheduled",
  service_hours_mode: "weekday_weekend",
  weekday_start_time: "07:00",
  weekday_end_time: "20:00",
  weekend_start_time: "10:00",
  weekend_end_time: "15:00",
  publication_status: "active",
};

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const offerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [images, setImages] = useState<ExistingOfferPhoto[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(-1);
  const [primaryImageUrl, setPrimaryImageUrl] = useState("");
  const [initialPrimaryImageUrl, setInitialPrimaryImageUrl] = useState("");
  const [existingVideos, setExistingVideos] = useState<ExistingOfferVideo[]>([]);
  const [newVideos, setNewVideos] = useState<SelectedOfferVideo[]>([]);
  const [existingRealizations, setExistingRealizations] = useState<ExistingServiceRealization[]>([]);
  const [newRealizations, setNewRealizations] = useState<ServiceRealizationDraft[]>([]);

  const [form, setForm] = useState<OfferFormState>(emptyForm);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);



  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        form,
        images: images.map((image) => ({
          id: image.id,
          image_url: image.image_url,
          sort_order: image.sort_order ?? null,
        })),
        primaryImageUrl,
        mainPhotoIndex,
        newPhotoPreviewsCount: newPhotoPreviews.length,
        newPhotos: newPhotos.map((photo) => ({
          name: photo.name,
          size: photo.size,
          type: photo.type,
          lastModified: photo.lastModified,
        })),
        existingVideoIds: existingVideos.map((video) => video.id),
        existingRealizationIds: existingRealizations.map((realization) => realization.id),
        newRealizations: newRealizations.map((realization) => ({
          localId: realization.localId,
          title: realization.title,
          description: realization.description,
          indicativePriceFrom: realization.indicativePriceFrom,
          files: realization.files.map((file) => ({ name: file.name, size: file.size, lastModified: file.lastModified })),
          videos: realization.videos.map((video) => ({ name: video.file.name, size: video.file.size, lastModified: video.file.lastModified })),
        })),
        newVideos: newVideos.map((video) => ({
          name: video.file.name,
          size: video.file.size,
          type: video.file.type,
          lastModified: video.file.lastModified,
        })),
      }),
    [form, images, primaryImageUrl, mainPhotoIndex, newPhotos, newPhotoPreviews.length, existingVideos, newVideos, existingRealizations, newRealizations],
  );

  const hasUnsavedChanges =
    !loading && Boolean(initialSnapshot) && currentSnapshot !== initialSnapshot;

  useUnsavedChangesWarning(
    hasUnsavedChanges && !saving && !allowNavigation,
    setPendingNavigationHref,
  );

  const loadItem = useCallback(async () => {
    const response = await fetch(`/api/offers/${offerId}`, {
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.item) {
      toast.error(result?.error || "Nabídku se nepodařilo načíst");
      router.push("/dashboard/my-offers");
      return;
    }

    const data = result.item;

    if (data.owner_id !== result.currentUserId) {
      toast.error("Tuhle nabídku může upravit pouze vlastník");
      router.push("/dashboard/my-offers");
      return;
    }

    const offerType = data.offer_type || "item";
    const rawPriceUnit = data.price_unit || "";
    const normalizedPriceUnit =
      offerType === "service"
        ? servicePriceUnits.includes(rawPriceUnit as (typeof servicePriceUnits)[number])
          ? rawPriceUnit
          : "hour"
        : itemPriceUnits.includes(rawPriceUnit as (typeof itemPriceUnits)[number])
          ? rawPriceUnit
          : "day";

    const nextForm: OfferFormState = {
      offer_type: offerType,
      title: data.title || "",
      description: data.description || "",
      category: data.category || "",
      condition: data.condition || "",
      price_amount: data.price_unit === "individual" ? "0" : data.price_amount?.toString() || "",
      price_unit: normalizedPriceUnit,
      price_note: data.price_note || "",
      deposit: data.deposit?.toString() || "",
      pickup_place: data.pickup_place || "",
      pickup_latitude: data.pickup_latitude || null,
      pickup_longitude: data.pickup_longitude || null,
      handover_options: data.handover_options || [],
      contact_note: data.contact_note || "",
      service_booking_mode: data.service_booking_mode === "deadline" ? "deadline" : "scheduled",
      service_hours_mode: data.service_hours_mode === "same_every_day" ? "same_every_day" : "weekday_weekend",
      weekday_start_time: data.weekday_start_time || "07:00",
      weekday_end_time: data.weekday_end_time || "20:00",
      weekend_start_time: data.weekend_start_time || "10:00",
      weekend_end_time: data.weekend_end_time || "15:00",
      publication_status:
        data.publication_status === "inactive" ? "inactive" : "active",
    };

    const nextImages = (result.images || []) as ExistingOfferPhoto[];
    const nextVideos = (result.videos || []) as ExistingOfferVideo[];
    const nextRealizations = (result.realizations || []) as ExistingServiceRealization[];
    const nextPrimaryImageUrl = data.primary_image_url || "";

    setForm(nextForm);
    setImages(nextImages);
    setPrimaryImageUrl(nextPrimaryImageUrl);
    setInitialPrimaryImageUrl(nextPrimaryImageUrl);
    setExistingVideos(nextVideos);
    setExistingRealizations(nextRealizations);
    setInitialSnapshot(
      JSON.stringify({
        form: nextForm,
        images: nextImages.map((image) => ({
          id: image.id,
          image_url: image.image_url,
          sort_order: image.sort_order ?? null,
        })),
        primaryImageUrl: nextPrimaryImageUrl,
        mainPhotoIndex: -1,
        newPhotoPreviewsCount: 0,
        newPhotos: [],
        existingVideoIds: nextVideos.map((video) => video.id),
        existingRealizationIds: nextRealizations.map((realization) => realization.id),
        newRealizations: [],
        newVideos: [],
      }),
    );
    setLoading(false);
  }, [offerId, router]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  async function deleteImage(imageId: string, imageUrl: string) {
    const response = await fetch(`/api/offers/${offerId}/images/${imageId}`, {
      method: "DELETE",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Fotku se nepodařilo smazat");
      return;
    }

    setImages((prev) => prev.filter((image) => image.id !== imageId));

    if (primaryImageUrl === imageUrl) {
      setPrimaryImageUrl(result?.primaryImageUrl || "");
    }

    toast.success("Fotka smazána");
  }

  async function deleteVideo(video: ExistingOfferVideo) {
    const response = await fetch(`/api/offers/${offerId}/videos/${video.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(result?.error || "Video se nepodařilo smazat");
      return;
    }
    setExistingVideos((current) => current.filter((item) => item.id !== video.id));
    toast.success("Video smazáno");
  }

  async function deleteRealization(realization: ExistingServiceRealization) {
    const response = await fetch(`/api/offers/${offerId}/realizations/${realization.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(result?.error || "Realizaci se nepodařilo smazat");
      return;
    }
    setExistingRealizations((current) => current.filter((item) => item.id !== realization.id));
    toast.success("Realizace smazána");
  }

  function makePrimary(imageUrl: string) {
    setMainPhotoIndex(-1);
    setPrimaryImageUrl(imageUrl);
  }

  function validateForm() {
    if (form.offer_type === "item" && images.length + newPhotos.length === 0) {
      throw new Error("Nahraj alespoň jednu fotku věci");
    }

    if (!form.title.trim()) throw new Error("Vyplň název nabídky");
    if (!form.category) throw new Error("Vyber kategorii");

    if (form.offer_type === "item" && !form.condition) {
      throw new Error("Vyber stav nabídky");
    }

    if (!form.description.trim()) throw new Error("Vyplň popis");
    if (form.price_unit !== "individual" && !form.price_amount.trim()) throw new Error("Vyplň cenu");
    if (!form.price_unit) throw new Error("Vyber jednotku ceny");

    if (form.offer_type === "service" && form.service_booking_mode === "scheduled") {
      const ranges = [
        [form.weekday_start_time, form.weekday_end_time, "pracovní dny"],
        [form.weekend_start_time, form.weekend_end_time, "víkend"],
      ] as const;

      for (const [start, end, label] of ranges) {
        if (!start || !end || end <= start) {
          throw new Error(`Nastav platnou provozní dobu pro ${label}`);
        }
      }
    }

    if (!form.pickup_place.trim() || !form.pickup_latitude || !form.pickup_longitude) {
      throw new Error(
        form.offer_type === "service"
          ? "Vyber lokalitu působení z našeptávače nebo zvol celou ČR"
          : "Vyber místo předání z našeptávače",
      );
    }

    if (form.offer_type === "item" && form.handover_options.length === 0) {
      throw new Error("Vyber alespoň jednu možnost předání");
    }

    if (form.offer_type === "service") {
      for (const realization of newRealizations) {
        if (!realization.title.trim()) throw new Error("Doplň název každé realizace");
        if (realization.files.length === 0) throw new Error("Ke každé realizaci přidej alespoň jednu fotografii");
      }
    }
  }

  async function saveItem() {
    setSaving(true);

    try {
      validateForm();

      const formData = new FormData();
      formData.append("payload", JSON.stringify(form));

      const orderedNewPhotos = [...newPhotos];

      if (mainPhotoIndex >= 0 && mainPhotoIndex < orderedNewPhotos.length) {
        const [mainPhoto] = orderedNewPhotos.splice(mainPhotoIndex, 1);

        if (mainPhoto) {
          orderedNewPhotos.unshift(mainPhoto);
        }

        formData.append("mainPhotoIndex", "0");
      }

      orderedNewPhotos.forEach((photo) => {
        formData.append("photos", photo);
      });

      const response = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Změny se nepodařilo uložit");
      }

      if (form.offer_type === "service" && newRealizations.length > 0) {
        for (let index = 0; index < newRealizations.length; index += 1) {
          await uploadServiceRealization(offerId, newRealizations[index], existingRealizations.length + index);
        }
      }

      if (newVideos.length > 0) {
        for (const video of newVideos) {
          await uploadOfferVideo(offerId, video);
        }
      }

      if (
        mainPhotoIndex < 0 &&
        primaryImageUrl &&
        primaryImageUrl !== initialPrimaryImageUrl
      ) {
        const primaryResponse = await fetch(
          `/api/offers/${offerId}/primary-image`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              imageUrl: primaryImageUrl,
            }),
          },
        );

        const primaryResult = await primaryResponse.json().catch(() => null);

        if (!primaryResponse.ok) {
          throw new Error(
            primaryResult?.error ||
              "Hlavní fotku se nepodařilo uložit",
          );
        }
      }

      setAllowNavigation(true);
      toast.success("Změny uloženy");
      router.push("/dashboard/my-offers");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Změny se nepodařilo uložit");
    } finally {
      setSaving(false);
    }
  }

  function leaveWithoutSaving() {
    const href = pendingNavigationHref;

    if (!href) return;

    setAllowNavigation(true);
    setPendingNavigationHref(null);

    const nextUrl = new URL(href, window.location.href);
    router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <PageLoader />
      </main>
    );
  }

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackLink href="/dashboard/my-offers" hideOnMobile>Moje nabídky</BackLink>
          </div>

          <h1 className="koluj-heading mt-6">Upravit nabídku</h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Uprav informace, cenu a základní nastavení nabídky.
          </p>
        </section>

        <section className="mt-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8">
            <OfferTypeSection offerType={form.offer_type} setForm={setForm} />

            <OfferPhotoUploader
              offerType={form.offer_type}
              existingImages={images}
              primaryImageUrl={primaryImageUrl}
              photos={newPhotos}
              setPhotos={setNewPhotos}
              photoPreviews={newPhotoPreviews}
              setPhotoPreviews={setNewPhotoPreviews}
              mainPhotoIndex={mainPhotoIndex}
              setMainPhotoIndex={setMainPhotoIndex}
              onMakePrimaryExisting={makePrimary}
              onDeleteExisting={deleteImage}
            />

            <OfferVideoUploader
              existingVideos={existingVideos}
              videos={newVideos}
              setVideos={setNewVideos}
              onDeleteExisting={deleteVideo}
            />

            <BasicInfoSection form={form} setForm={setForm} />
            <PriceSection form={form} setForm={setForm} />
            <ServiceBookingSettingsSection form={form} setForm={setForm} />
            <ServiceRealizationsEditor
              offerType={form.offer_type}
              existing={existingRealizations}
              drafts={newRealizations}
              setDrafts={setNewRealizations}
              onDeleteExisting={deleteRealization}
            />
            <LocationSection form={form} setForm={setForm} />
            <AvailabilityInfoSection mode="edit" />

            <MobileSubmitButton mode="edit" isSubmitting={saving} onSubmit={saveItem} />
          </div>

          <OfferFormSidebar
            mode="edit"
            form={form}
            photosCount={images.length + newPhotos.length}
            isSubmitting={saving}
            onSubmit={saveItem}
          />
            </div>
          </div>
        </section>

        <ConfirmLeaveDialog
          open={Boolean(pendingNavigationHref)}
          onStay={() => setPendingNavigationHref(null)}
          onLeave={leaveWithoutSaving}
        />
      </div>
    </main>
  );
}
