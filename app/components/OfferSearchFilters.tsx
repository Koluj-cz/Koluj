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
    "koluj-select font-bold disabled:cursor-not-allowed disabled:opacity-55";

  return (
    <section className="koluj-searchbar">
      <div className="contents">
        <div className="flex min-h-[46px] items-center gap-3 rounded-[14px] border border-[var(--koluj-border)] bg-white px-4">
          <Search size={20} className="shrink-0 text-[var(--koluj-muted)]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-3 font-medium text-[var(--koluj-text)] outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={onUseLocation}
            disabled={!onUseLocation}
            className="hidden shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-[var(--koluj-green)] sm:flex disabled:cursor-not-allowed disabled:opacity-55"
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
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] border border-[var(--koluj-border)] bg-white px-5 py-3 font-black text-[var(--koluj-muted)] sm:hidden disabled:cursor-not-allowed disabled:opacity-55"
      >
        <LocateFixed size={18} />
        Okolo mě
      </button>
    </section>
  );
}
