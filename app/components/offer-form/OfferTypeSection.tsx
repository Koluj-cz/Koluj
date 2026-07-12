"use client";

import { Package } from "lucide-react";
import SectionTitle from "@/app/components/SectionTitle";
import { offerTypeLabels } from "@/lib/constants";
import type { OfferFormState } from "@/app/components/offer-form/types";

type OfferTypeSectionProps = {
  offerType: string;
  setForm: React.Dispatch<React.SetStateAction<OfferFormState>>;
};

export default function OfferTypeSection({ offerType, setForm }: OfferTypeSectionProps) {
  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle icon={<Package size={24} />} title="Co chceš nabídnout?" />

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {["item", "service"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                offer_type: type,
                category: "",
                condition: type === "service" ? "" : prev.condition,
                price_unit: type === "service" ? "hour" : "day",
                deposit: type === "service" ? "" : prev.deposit,
                handover_options: type === "service" ? [] : prev.handover_options,
                service_booking_mode: type === "service" ? prev.service_booking_mode || "scheduled" : "scheduled",
                service_hours_mode: type === "service" ? prev.service_hours_mode || "weekday_weekend" : "weekday_weekend",
                weekday_start_time: type === "service" ? prev.weekday_start_time || "07:00" : "07:00",
                weekday_end_time: type === "service" ? prev.weekday_end_time || "20:00" : "20:00",
                weekend_start_time: type === "service" ? prev.weekend_start_time || "10:00" : "10:00",
                weekend_end_time: type === "service" ? prev.weekend_end_time || "15:00" : "15:00",
              }))
            }
            className={`rounded-3xl px-5 py-4 text-left font-black ${
              offerType === type
                ? "bg-[var(--koluj-green)] text-white"
                : "bg-[var(--koluj-bg)] text-[var(--koluj-text)]"
            }`}
          >
            {offerTypeLabels[type as keyof typeof offerTypeLabels]}
            <span className="mt-1 block text-sm font-bold opacity-80">
              {type === "item"
                ? "Fyzická věc s předáním a rezervací po dnech."
                : "Čas, práce nebo pomoc s rezervací po hodinách."}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
