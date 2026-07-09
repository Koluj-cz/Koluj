"use client";

import { useRef, useState } from "react";
import { Check, MapPin } from "lucide-react";
import SectionTitle from "@/app/components/SectionTitle";
import { handoverLabels, handoverOptions } from "@/lib/constants";
import type { OfferFormState, PlaceSuggestion } from "@/app/components/offer-form/types";

type LocationSectionProps = {
  form: OfferFormState;
  setForm: React.Dispatch<React.SetStateAction<OfferFormState>>;
};

export default function LocationSection({ form, setForm }: LocationSectionProps) {
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateField(field: keyof OfferFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleHandoverOption(option: string) {
    setForm((prev) => {
      const exists = prev.handover_options.includes(option);

      return {
        ...prev,
        handover_options: exists
          ? prev.handover_options.filter((item) => item !== option)
          : [...prev.handover_options, option],
      };
    });
  }

  function searchPlaces(value: string) {
    setForm((prev) => ({
      ...prev,
      pickup_place: value,
      pickup_latitude: null,
      pickup_longitude: null,
    }));

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length < 2) {
      setPlaceSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const response = await fetch(`/api/places?q=${encodeURIComponent(value)}`);
      const data = await response.json().catch(() => null);

      setPlaceSuggestions(data?.items || []);
    }, 300);
  }

  function selectPlace(place: PlaceSuggestion) {
    setForm((prev) => ({
      ...prev,
      pickup_place: `${place.name}${place.location ? `, ${place.location}` : ""}`,
      pickup_latitude: place.position.lat,
      pickup_longitude: place.position.lon,
    }));

    setPlaceSuggestions([]);
  }

  return (
    <div className="koluj-card p-5 md:p-8">
      <SectionTitle
        icon={<MapPin size={24} />}
        title={form.offer_type === "service" ? "Lokalita působení" : "Předání"}
      />

      <div className="relative mt-6">
        <input
          value={form.pickup_place}
          onChange={(event) => searchPlaces(event.target.value)}
          placeholder={form.offer_type === "service" ? "Lokalita působení *" : "Místo předání *"}
          className="koluj-input"
        />

        {form.offer_type === "service" && (
          <button
            type="button"
            onClick={() => {
              setForm((prev) => ({
                ...prev,
                pickup_place: "Celá Česká republika",
                pickup_latitude: 49.8175,
                pickup_longitude: 15.473,
              }));
              setPlaceSuggestions([]);
            }}
            className="mt-3 rounded-2xl bg-[var(--koluj-bg)] px-4 py-3 text-sm font-black text-[var(--koluj-green)]"
          >
            Působím po celé ČR
          </button>
        )}

        {placeSuggestions.length > 0 && (
          <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-surface)] shadow-lg">
            {placeSuggestions.map((place, index) => (
              <button
                key={`${place.name}-${index}`}
                type="button"
                onClick={() => selectPlace(place)}
                className="block w-full px-5 py-4 text-left hover:bg-[var(--koluj-bg)]"
              >
                <div className="font-bold">{place.name}</div>
                <div className="text-sm text-[var(--koluj-muted)]">
                  {place.label} {place.location ? `· ${place.location}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {form.offer_type === "item" && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {handoverOptions.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleHandoverOption(value)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 font-bold ${
                form.handover_options.includes(value)
                  ? "border-[var(--koluj-green)] bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
                  : "border-[var(--koluj-border)] text-[var(--koluj-muted)]"
              }`}
            >
              {form.handover_options.includes(value) && <Check size={18} />}
              {handoverLabels[value]}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={form.contact_note}
        onChange={(event) => updateField("contact_note", event.target.value)}
        placeholder={
          form.offer_type === "service"
            ? "Poznámka ke službě, např. dojezd, online varianta nebo ideální časy"
            : "Poznámka k předání, např. ideálně po 17:00"
        }
        className="koluj-input mt-5 min-h-28"
      />
    </div>
  );
}
