"use client";

import { LocateFixed, Search } from "lucide-react";

export type SelectOption = { value: string; label: string };

type OfferSearchFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  offerType?: string;
  onOfferTypeChange?: (value: string) => void;
  offerTypeOptions?: SelectOption[];
  category?: string;
  onCategoryChange?: (value: string) => void;
  categoryOptions?: SelectOption[];
  status?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: SelectOption[];
  sortBy?: string;
  onSortByChange?: (value: string) => void;
  sortOptions?: SelectOption[];
  onUseLocation?: () => void;
  locationActive?: boolean;
};

export default function OfferSearchFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Hledat nabídku...",
  offerType = "all",
  onOfferTypeChange,
  offerTypeOptions = [{ value: "all", label: "Vše" }],
  category = "all",
  onCategoryChange,
  categoryOptions = [{ value: "all", label: "Všechny kategorie" }],
  status = "all",
  onStatusChange,
  statusOptions = [{ value: "all", label: "Všechny stavy" }],
  sortBy = "newest",
  onSortByChange,
  sortOptions = [{ value: "newest", label: "Nejnovější" }],
  onUseLocation,
  locationActive = false,
}: OfferSearchFiltersProps) {
  const selectClass =
    "min-h-[56px] w-full rounded-2xl border border-[var(--koluj-border)] bg-white px-4 font-semibold text-[var(--koluj-text)] outline-none transition focus:border-[var(--koluj-green)] focus:shadow-[0_0_0_5px_rgba(47,93,58,0.09)] disabled:cursor-not-allowed disabled:opacity-55";

  return (
    <section className="rounded-[28px] border border-[var(--koluj-border)] bg-white p-3 md:p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_180px_230px_210px_190px]">
        <div className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-[var(--koluj-border)] bg-white px-4 transition focus-within:border-[var(--koluj-green)] focus-within:shadow-[0_0_0_5px_rgba(47,93,58,0.09)]">
          <Search size={20} className="shrink-0 text-[var(--koluj-muted)]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-4 font-normal text-[var(--koluj-text)] outline-none placeholder:text-[var(--koluj-muted)]"
          />
          <button
            type="button"
            onClick={onUseLocation}
            disabled={!onUseLocation}
            className={`hidden shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition sm:flex ${
              locationActive
                ? "bg-[var(--koluj-green)] text-white"
                : "bg-[var(--koluj-bg)] text-[var(--koluj-green)] hover:bg-white disabled:hover:bg-[var(--koluj-bg)]"
            } disabled:cursor-not-allowed disabled:opacity-55`}
          >
            <LocateFixed size={16} />
            Okolo mě
          </button>
        </div>

        <select value={offerType} onChange={(e) => onOfferTypeChange?.(e.target.value)} disabled={!onOfferTypeChange} className={selectClass}>
          {offerTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={category} onChange={(e) => onCategoryChange?.(e.target.value)} disabled={!onCategoryChange} className={selectClass}>
          {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={status} onChange={(e) => onStatusChange?.(e.target.value)} disabled={!onStatusChange} className={selectClass}>
          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => onSortByChange?.(e.target.value)} disabled={!onSortByChange} className={selectClass}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <button
        type="button"
        onClick={onUseLocation}
        disabled={!onUseLocation}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full border px-5 py-3 font-semibold transition sm:hidden ${
          locationActive
            ? "border-[var(--koluj-green)] bg-[var(--koluj-green)] text-white"
            : "border-[var(--koluj-border)] bg-white/82 text-[var(--koluj-muted)] hover:bg-[var(--koluj-bg)]"
        } disabled:cursor-not-allowed disabled:opacity-55`}
      >
        <LocateFixed size={18} />
        Okolo mě
      </button>
    </section>
  );
}
