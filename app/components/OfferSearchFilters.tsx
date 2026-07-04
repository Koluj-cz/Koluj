"use client";

import { Search } from "lucide-react";

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
}: OfferSearchFiltersProps) {
  const selectClass =
    "h-[58px] w-full rounded-[22px] border border-[var(--koluj-border)] bg-white px-4 font-bold text-[var(--koluj-text)] outline-none shadow-sm focus:border-[var(--koluj-green)] focus:shadow-[0_0_0_4px_rgba(95,127,43,0.10)] disabled:cursor-not-allowed disabled:opacity-55";

  return (
    <section className="koluj-card p-3 md:p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_170px_220px_210px_190px]">
        <div className="flex h-[58px] min-w-0 items-center gap-3 rounded-[22px] border border-[var(--koluj-border)] bg-white px-4 shadow-sm focus-within:border-[var(--koluj-green)] focus-within:shadow-[0_0_0_4px_rgba(95,127,43,0.10)]">
          <Search size={21} className="shrink-0 text-[var(--koluj-muted)]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-4 text-base font-bold text-[var(--koluj-text)] outline-none placeholder:text-slate-400"
          />
        </div>

        <select value={offerType} onChange={(event) => onOfferTypeChange?.(event.target.value)} disabled={!onOfferTypeChange} className={selectClass}>
          {offerTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <select value={category} onChange={(event) => onCategoryChange?.(event.target.value)} disabled={!onCategoryChange} className={selectClass}>
          {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <select value={status} onChange={(event) => onStatusChange?.(event.target.value)} disabled={!onStatusChange} className={selectClass}>
          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <select value={sortBy} onChange={(event) => onSortByChange?.(event.target.value)} disabled={!onSortByChange} className={selectClass}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    </section>
  );
}
