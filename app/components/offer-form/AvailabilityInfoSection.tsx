"use client";

import SectionTitle from "@/app/components/SectionTitle";
import type { OfferFormMode } from "@/app/components/offer-form/types";

type AvailabilityInfoSectionProps = {
  mode: OfferFormMode;
};

export default function AvailabilityInfoSection({ mode }: AvailabilityInfoSectionProps) {
  const isEdit = mode === "edit";

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle title="Dostupnost" />

      <div className="mt-6 rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-6">
        <p className="text-lg font-bold text-[var(--koluj-green)]">
          {isEdit
            ? "📅 Dostupnost se spravuje v kalendáři této nabídky."
            : "📅 Dostupnost se nastavuje až po vytvoření nabídky."}
        </p>

        <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">
          {isEdit
            ? "Kalendář najdeš v detailu nabídky. Zde můžeš blokovat vlastní termíny, schvalovat rezervace a sledovat obsazené dny."
            : "Po uložení budeš moci v detailu nabídky spravovat kalendář dostupnosti, blokovat termíny a schvalovat rezervace. Ostatní uživatelé okamžitě uvidí, které dny jsou volné a které obsazené."}
        </p>
      </div>
    </div>
  );
}
