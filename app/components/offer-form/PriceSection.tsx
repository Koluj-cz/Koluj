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
  const isIndividualService =
    form.offer_type === "service" && form.price_unit === "individual";

  function updateField(field: keyof OfferFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updatePriceUnit(value: string) {
    setForm((prev) => ({
      ...prev,
      price_unit: value,
      price_amount:
        prev.offer_type === "service" && value === "individual"
          ? "0"
          : prev.price_unit === "individual" && prev.price_amount === "0"
            ? ""
            : prev.price_amount,
    }));
  }

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle title="Cena" />

      <div className="mt-6 space-y-4">
        <div className={`grid gap-4 ${isIndividualService ? "" : "md:grid-cols-[1fr_180px]"}`}>
          {!isIndividualService && (
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.price_amount}
              onChange={(event) => updateField("price_amount", event.target.value)}
              onWheel={(event) => event.currentTarget.blur()}
              placeholder="Cena v Kč *"
              className="koluj-input"
            />
          )}

          <select
            value={form.price_unit}
            onChange={(event) => updatePriceUnit(event.target.value)}
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

        {isIndividualService && (
          <p className="rounded-2xl bg-[var(--koluj-bg)] px-4 py-3 text-sm font-bold text-[var(--koluj-muted)]">
            Cena se domluví individuálně v chatu po odeslání poptávky.
          </p>
        )}

        <textarea
          value={form.price_note}
          onChange={(event) => updateField("price_note", event.target.value)}
          placeholder={
            isIndividualService
              ? "Volitelně upřesni, podle čeho se bude cena určovat"
              : "Poznámka k ceně, např. víkend za 250 Kč nebo sleva při delší rezervaci"
          }
          className="koluj-input min-h-28"
        />

        {form.offer_type === "item" && (
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={form.deposit}
            onChange={(event) => updateField("deposit", event.target.value)}
            onWheel={(event) => event.currentTarget.blur()}
            placeholder="Kauce Kč, volitelné"
            className="koluj-input"
          />
        )}
      </div>
    </div>
  );
}
