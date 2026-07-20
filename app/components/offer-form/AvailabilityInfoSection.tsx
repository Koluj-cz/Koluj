"use client";

import SectionTitle from "@/app/components/SectionTitle";
import HelpTopic from "@/app/components/help/HelpTopic";
import type { OfferFormMode } from "@/app/components/offer-form/types";

type AvailabilityInfoSectionProps = {
  mode: OfferFormMode;
};

export default function AvailabilityInfoSection({ mode }: AvailabilityInfoSectionProps) {
  const isEdit = mode === "edit";

  return (
    <div className="koluj-card p-5 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle title="Dostupnost" />
        <HelpTopic
          compact
          triggerLabel="Jak nastavit dostupnost nabídky"
          title="Dostupnost nabídky"
          items={[
            { title: "Základní dostupnost", description: "U služby ji určuje provozní doba. U věci je nabídka běžně volná, pokud není rezervovaná nebo blokovaná." },
            { title: "Blokace", description: "Slouží pro dovolenou, servis, vlastní používání věci nebo jiný termín, kdy nabídku nechceš zpřístupnit." },
            { title: "Rezervované termíny", description: "Schválené a probíhající rezervace se do kalendáře zapisují automaticky." },
          ]}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-6">
        <p className="text-lg font-bold text-[var(--koluj-green)]">
          {isEdit
            ? "📅 Výjimky a blokace se spravují v kalendáři této nabídky."
            : "📅 Po vytvoření nabídky můžeš přidávat výjimky a blokace."}
        </p>

        <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">
          {isEdit
            ? "Základní provozní dobu služby nastavíš přímo v tomto formuláři. Kalendář v detailu pak slouží pro dovolenou, jednorázové blokace a obsazené termíny."
            : "Základní provozní dobu služby nastavíš výše. Po uložení můžeš v detailu nabídky přidávat jednorázové blokace a další výjimky."}
        </p>
      </div>
    </div>
  );
}
