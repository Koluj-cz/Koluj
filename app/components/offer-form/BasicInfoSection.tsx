"use client";

import dynamic from "next/dynamic";
import { Package } from "lucide-react";
import SectionTitle from "@/app/components/SectionTitle";
import {
  categories,
  categoryLabels,
  conditions,
  conditionLabels,
  serviceCategories,
  serviceCategoryLabels,
} from "@/lib/constants";
import type { OfferFormState } from "@/app/components/offer-form/types";

const RichTextEditor = dynamic(() => import("@/app/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="rounded-3xl border border-[var(--koluj-border)] bg-white p-4 text-sm font-bold text-[var(--koluj-muted)]">
      Editor popisu se načítá...
    </div>
  ),
});

type BasicInfoSectionProps = {
  form: OfferFormState;
  setForm: React.Dispatch<React.SetStateAction<OfferFormState>>;
};

export default function BasicInfoSection({ form, setForm }: BasicInfoSectionProps) {
  function updateField(field: keyof OfferFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle icon={<Package size={24} />} title="O nabídce" />

      <div className="mt-6 space-y-4">
        <input
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder={form.offer_type === "service" ? "Název služby *" : "Název nabídky *"}
          className="koluj-input"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <select
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
            className="koluj-input"
          >
            <option value="">Kategorie *</option>
            {(form.offer_type === "service" ? serviceCategories : categories).map((category) => (
              <option key={category} value={category}>
                {form.offer_type === "service"
                  ? serviceCategoryLabels[category as keyof typeof serviceCategoryLabels]
                  : categoryLabels[category as keyof typeof categoryLabels]}
              </option>
            ))}
          </select>

          {form.offer_type === "item" && (
            <select
              value={form.condition}
              onChange={(event) => updateField("condition", event.target.value)}
              className="koluj-input"
            >
              <option value="">Stav věci *</option>
              {conditions.map((condition) => (
                <option key={condition} value={condition}>
                  {conditionLabels[condition]}
                </option>
              ))}
            </select>
          )}
        </div>

        <RichTextEditor
          value={form.description}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              description: value,
            }))
          }
        />
      </div>
    </div>
  );
}
