"use client";

import { Lightbulb, X } from "lucide-react";
import type { SearchIntentMatch, SearchIntentRecommendation } from "@/lib/services/searchIntentService";

export default function SmartSearchSuggestions({
  intent,
  onSelect,
  onDismiss,
}: {
  intent: SearchIntentMatch;
  onSelect: (recommendation: SearchIntentRecommendation) => void;
  onDismiss: () => void;
}) {
  return (
    <section className="koluj-card mb-6 border-[var(--koluj-green)]/20 bg-gradient-to-br from-white to-[var(--koluj-green-pale)] p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[var(--koluj-green)] shadow-sm">
            <Lightbulb size={15} /> Rozpoznaný záměr: {intent.name}
          </p>
          <h2 className="mt-4 text-xl font-black tracking-[-0.035em] md:text-2xl">
            Možná budete potřebovat také
          </h2>
          {intent.description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--koluj-muted)] md:text-base">
              {intent.description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--koluj-muted)] shadow-sm transition hover:bg-[var(--koluj-bg)] hover:text-[var(--koluj-text)]"
          aria-label="Skrýt doporučení"
        >
          <X size={19} />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        {intent.recommendations.map((recommendation) => (
          <button
            key={recommendation.id}
            type="button"
            onClick={() => onSelect(recommendation)}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--koluj-border)] bg-white px-4 py-2.5 text-sm font-black shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--koluj-green)] hover:text-[var(--koluj-green)]"
          >
            {recommendation.label}
          </button>
        ))}
      </div>
    </section>
  );
}
