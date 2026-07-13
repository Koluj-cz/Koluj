"use client";

import { Plus, Save } from "lucide-react";
import CheckLine from "@/app/components/CheckLine";
import StickySidebar from "@/app/components/StickySidebar";
import type {
  OfferFormMode,
  OfferFormState,
} from "@/app/components/offer-form/types";

type OfferFormSidebarProps = {
  mode: OfferFormMode;
  form: OfferFormState;
  photosCount: number;
  isSubmitting: boolean;
  onSubmit: () => void;
};

export default function OfferFormSidebar({
  mode,
  form,
  photosCount,
  isSubmitting,
  onSubmit,
}: OfferFormSidebarProps) {
  const isNew = mode === "new";
  const ButtonIcon = isNew ? Plus : Save;

  return (
    <StickySidebar>
      <div className="koluj-card p-8">
        <h2 className="text-2xl font-black">
          {isNew ? "Kontrola před uložením" : "Kontrola nabídky"}
        </h2>

        <ul className="mt-6 space-y-4 text-[var(--koluj-muted)]">
          {form.offer_type === "item" ? (
            <CheckLine done={photosCount > 0} text="Alespoň jedna fotka" />
          ) : (
            <CheckLine done={true} text="Fotky jsou volitelné" />
          )}

          <CheckLine done={Boolean(form.title)} text="Název nabídky" />
          <CheckLine done={Boolean(form.category)} text="Kategorie" />

          {form.offer_type === "item" && (
            <CheckLine done={Boolean(form.condition)} text="Stav věci" />
          )}

          <CheckLine
            done={Boolean(form.price_unit === "individual" || (form.price_amount && form.price_unit))}
            text="Cena"
          />

          {form.offer_type === "service" && (
            <CheckLine
              done={
                form.service_booking_mode === "deadline" ||
                Boolean(
                  form.weekday_start_time &&
                    form.weekday_end_time &&
                    form.weekend_start_time &&
                    form.weekend_end_time,
                )
              }
              text={
                form.service_booking_mode === "deadline"
                  ? "Flexibilní termín dokončení"
                  : "Provozní doba služby"
              }
            />
          )}

          <CheckLine
            done={Boolean(form.pickup_latitude)}
            text={
              form.offer_type === "item"
                ? "Místo předání"
                : "Lokalita působení"
            }
          />
        </ul>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="koluj-button mt-8 w-full px-6 py-4 disabled:opacity-60"
        >
          <ButtonIcon size={18} />
          {isSubmitting
            ? "Ukládám..."
            : isNew
              ? "Přidat nabídku"
              : "Uložit změny"}
        </button>
      </div>
    </StickySidebar>
  );
}
