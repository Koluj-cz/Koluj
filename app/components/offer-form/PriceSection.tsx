"use client";

import SectionTitle from "@/app/components/SectionTitle";
import {
  itemPriceUnitLabels,
  itemPriceUnits,
  servicePriceUnitLabels,
  servicePriceUnits,
} from "@/lib/constants";
import type { OfferFormState } from "@/app/components/offer-form/types";

type PriceSectionProps = {
  form: OfferFormState;
  setForm: React.Dispatch<React.SetStateAction<OfferFormState>>;
};

export default function PriceSection({ form, setForm }: PriceSectionProps) {
  function updateField(field: keyof OfferFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle title="Cena" />

      <div className="mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <input
            type="number"
            min="0"
            value={form.price_amount}
            onChange={(event) => updateField("price_amount", event.target.value)}
            placeholder="Cena v Kč *"
            className="koluj-input"
          />

          <select
            value={form.price_unit}
            onChange={(event) => updateField("price_unit", event.target.value)}
            className="koluj-input"
          >
            {(form.offer_type === "service" ? servicePriceUnits : itemPriceUnits).map((unit) => (
              <option key={unit} value={unit}>
                {form.offer_type === "service"
                  ? servicePriceUnitLabels[unit]
                  : itemPriceUnitLabels[unit]}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={form.price_note}
          onChange={(event) => updateField("price_note", event.target.value)}
          placeholder="Poznámka k ceně, např. víkend za 250 Kč nebo sleva při delší rezervaci"
          className="koluj-input min-h-28"
        />

        {form.offer_type === "item" && (
          <input
            type="number"
            value={form.deposit}
            onChange={(event) => updateField("deposit", event.target.value)}
            placeholder="Kauce Kč, volitelné"
            className="koluj-input"
          />
        )}
      </div>
    </div>
  );
}
