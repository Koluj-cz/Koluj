"use client";

import Image from "next/image";
import { Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import type { ServiceRealizationDraft } from "@/lib/uploadServiceRealization";

export type ExistingServiceRealization = {
  id: string;
  title: string;
  description: string | null;
  indicative_price_from: number | null;
  sort_order: number | null;
  images: { id: string; image_url: string; sort_order: number | null }[];
};

type Props = {
  offerType: string;
  drafts: ServiceRealizationDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<ServiceRealizationDraft[]>>;
  existing?: ExistingServiceRealization[];
  onDeleteExisting?: (realization: ExistingServiceRealization) => void;
};

const MAX_REALIZATIONS = 12;
const MAX_IMAGES = 5;

function createDraft(): ServiceRealizationDraft {
  return {
    localId: crypto.randomUUID(),
    title: "",
    description: "",
    indicativePriceFrom: "",
    files: [],
    previews: [],
  };
}

export default function ServiceRealizationsEditor({
  offerType,
  drafts,
  setDrafts,
  existing = [],
  onDeleteExisting,
}: Props) {
  if (offerType !== "service") return null;

  const totalCount = existing.length + drafts.length;

  function updateDraft(localId: string, patch: Partial<ServiceRealizationDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.localId === localId ? { ...draft, ...patch } : draft)),
    );
  }

  function removeDraft(localId: string) {
    setDrafts((current) => {
      const target = current.find((draft) => draft.localId === localId);
      target?.previews.forEach((preview) => URL.revokeObjectURL(preview));
      return current.filter((draft) => draft.localId !== localId);
    });
  }

  return (
    <section className="koluj-card p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Realizace</h2>
          <p className="mt-2 max-w-2xl text-[var(--koluj-muted)]">
            Ukaž hotové zakázky jako inspiraci. Cena je pouze orientační a zákazník vždy posílá poptávku.
          </p>
        </div>
        <button
          type="button"
          disabled={totalCount >= MAX_REALIZATIONS}
          onClick={() => setDrafts((current) => [...current, createDraft()])}
          className="koluj-button inline-flex items-center gap-2 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} /> Přidat realizaci
        </button>
      </div>

      {existing.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {existing.map((realization) => (
            <article key={realization.id} className="rounded-2xl border border-[var(--koluj-border)] p-4">
              <div className="flex gap-4">
                <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-[var(--koluj-bg)]">
                  {realization.images[0]?.image_url && (
                    <Image src={realization.images[0].image_url} alt="" fill sizes="112px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black">{realization.title}</p>
                  {realization.indicative_price_from !== null && (
                    <p className="mt-1 text-sm font-black text-[var(--koluj-green)]">
                      Orientačně od {realization.indicative_price_from} Kč
                    </p>
                  )}
                  <p className="mt-1 text-sm text-[var(--koluj-muted)]">
                    {realization.images.length} {realization.images.length === 1 ? "fotka" : "fotek"}
                  </p>
                </div>
                {onDeleteExisting && (
                  <button
                    type="button"
                    onClick={() => onDeleteExisting(realization)}
                    className="self-start text-red-600"
                    aria-label="Smazat realizaci"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-5">
        {drafts.map((draft, index) => (
          <div key={draft.localId} className="rounded-3xl border border-[var(--koluj-border)] p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black">Nová realizace {index + 1}</h3>
              <button
                type="button"
                onClick={() => removeDraft(draft.localId)}
                className="text-red-600"
                aria-label="Odebrat realizaci"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
                Název realizace
                <input
                  className="koluj-input"
                  maxLength={120}
                  value={draft.title}
                  onChange={(event) => updateDraft(draft.localId, { title: event.target.value })}
                  placeholder="Např. Držák na mobil"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
                Orientační cena od (Kč)
                <input
                  className="koluj-input"
                  type="number"
                  min="0"
                  step="1"
                  value={draft.indicativePriceFrom}
                  onChange={(event) => updateDraft(draft.localId, { indicativePriceFrom: event.target.value })}
                  placeholder="Např. 250"
                />
              </label>
            </div>

            <label className="mt-4 grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
              Krátký popis
              <textarea
                className="koluj-input min-h-24"
                maxLength={1000}
                value={draft.description}
                onChange={(event) => updateDraft(draft.localId, { description: event.target.value })}
                placeholder="Materiál, rozměr nebo čím byla realizace zajímavá."
              />
            </label>

            <label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--koluj-border)] px-4 py-4 font-black text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]">
              Přidat fotografie ({draft.files.length}/{MAX_IMAGES})
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  const selected = Array.from(event.target.files || []);
                  event.currentTarget.value = "";
                  if (draft.files.length + selected.length > MAX_IMAGES) {
                    toast.error(`Jedna realizace může mít maximálně ${MAX_IMAGES} fotek`);
                    return;
                  }
                  if (selected.some((file) => file.size > 10 * 1024 * 1024)) {
                    toast.error("Jedna fotografie realizace může mít maximálně 10 MB");
                    return;
                  }
                  updateDraft(draft.localId, {
                    files: [...draft.files, ...selected],
                    previews: [...draft.previews, ...selected.map((file) => URL.createObjectURL(file))],
                  });
                }}
              />
            </label>

            {draft.previews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {draft.previews.map((preview, imageIndex) => (
                  <div key={preview} className="relative aspect-square overflow-hidden rounded-xl bg-[var(--koluj-bg)]">
                    <Image src={preview} alt="" fill sizes="160px" className="object-cover" unoptimized />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(preview);
                        updateDraft(draft.localId, {
                          files: draft.files.filter((_, indexToKeep) => indexToKeep !== imageIndex),
                          previews: draft.previews.filter((_, indexToKeep) => indexToKeep !== imageIndex),
                        });
                      }}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-red-600 shadow"
                      aria-label="Odebrat fotografii"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalCount === 0 && (
        <p className="mt-6 rounded-2xl bg-[var(--koluj-bg)] p-5 font-bold text-[var(--koluj-muted)]">
          Realizace nejsou povinné. Můžeš je doplnit nyní nebo později při úpravě služby.
        </p>
      )}
    </section>
  );
}
