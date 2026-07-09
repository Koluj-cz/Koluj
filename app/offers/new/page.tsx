"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import BackLink from "@/app/components/BackLink";
import ConfirmLeaveDialog from "@/app/components/ConfirmLeaveDialog";
import AvailabilityInfoSection from "@/app/components/offer-form/AvailabilityInfoSection";
import BasicInfoSection from "@/app/components/offer-form/BasicInfoSection";
import LocationSection from "@/app/components/offer-form/LocationSection";
import MobileSubmitButton from "@/app/components/offer-form/MobileSubmitButton";
import OfferFormSidebar from "@/app/components/offer-form/OfferFormSidebar";
import OfferPhotoUploader from "@/app/components/offer-form/OfferPhotoUploader";
import OfferTypeSection from "@/app/components/offer-form/OfferTypeSection";
import PriceSection from "@/app/components/offer-form/PriceSection";
import type { OfferFormState } from "@/app/components/offer-form/types";
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning";

const initialForm: OfferFormState = {
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
};

export default function NewItemPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [form, setForm] = useState<OfferFormState>(initialForm);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    return (
      photos.length > 0 ||
      photoPreviews.length > 0 ||
      form.offer_type !== initialForm.offer_type ||
      form.title.trim() !== "" ||
      form.description.trim() !== "" ||
      form.category !== "" ||
      form.condition !== "" ||
      form.price_amount.trim() !== "" ||
      form.price_unit !== initialForm.price_unit ||
      form.price_note.trim() !== "" ||
      form.deposit.trim() !== "" ||
      form.pickup_place.trim() !== "" ||
      form.pickup_latitude !== null ||
      form.pickup_longitude !== null ||
      form.handover_options.length > 0 ||
      form.contact_note.trim() !== ""
    );
  }, [form, photos, photoPreviews.length]);

  useUnsavedChangesWarning(
    hasUnsavedChanges && !loading && !allowNavigation,
    setPendingNavigationHref,
  );

  function validateForm() {
    if (photos.some((photo) => photo.size > 15 * 1024 * 1024)) {
      throw new Error("Fotka je příliš velká. Maximum je 15 MB.");
    }

    if (form.offer_type === "item" && photos.length === 0) {
      throw new Error("Nahraj alespoň jednu fotku věci");
    }

    if (!form.title.trim()) throw new Error("Vyplň název nabídky");
    if (!form.category) throw new Error("Vyber kategorii");

    if (form.offer_type === "item" && !form.condition) {
      throw new Error("Vyber stav věci");
    }

    if (!form.description.trim()) throw new Error("Vyplň popis");
    if (!form.price_amount.trim()) throw new Error("Vyplň cenu");
    if (!form.price_unit) throw new Error("Vyber jednotku ceny");

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
  }

  async function handleSubmit() {
    setLoading(true);

    try {
      validateForm();

      const formData = new FormData();
      formData.append("payload", JSON.stringify(form));

      const safeMainPhotoIndex =
        mainPhotoIndex >= 0 && mainPhotoIndex < photos.length ? mainPhotoIndex : 0;
      const orderedPhotos = [...photos];
      const [mainPhoto] = orderedPhotos.splice(safeMainPhotoIndex, 1);
      const finalPhotos = mainPhoto ? [mainPhoto, ...orderedPhotos] : orderedPhotos;

      formData.append("mainPhotoIndex", "0");

      finalPhotos.forEach((photo) => {
        formData.append("photos", photo);
      });

      const response = await fetch("/api/offers", {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Nepodařilo se uložit nabídku");
      }

      setAllowNavigation(true);
      toast.success("Nabídka byla přidána");
      router.push("/dashboard/my-offers");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepodařilo se uložit nabídku");
    } finally {
      setLoading(false);
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

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackLink href="/dashboard">Dashboard</BackLink>
          </div>

          <h1 className="koluj-heading mt-6">Přidat nabídku</h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Vyplň jen to důležité. Nabídnout můžeš věc i službu.
          </p>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8">
            <OfferTypeSection offerType={form.offer_type} setForm={setForm} />

            <OfferPhotoUploader
              offerType={form.offer_type}
              photos={photos}
              setPhotos={setPhotos}
              photoPreviews={photoPreviews}
              setPhotoPreviews={setPhotoPreviews}
              mainPhotoIndex={mainPhotoIndex}
              setMainPhotoIndex={setMainPhotoIndex}
            />

            <BasicInfoSection form={form} setForm={setForm} />
            <PriceSection form={form} setForm={setForm} />
            <LocationSection form={form} setForm={setForm} />
            <AvailabilityInfoSection mode="new" />

            <MobileSubmitButton mode="new" isSubmitting={loading} onSubmit={handleSubmit} />
          </div>

          <OfferFormSidebar
            mode="new"
            form={form}
            photosCount={photos.length}
            isSubmitting={loading}
            onSubmit={handleSubmit}
          />
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
