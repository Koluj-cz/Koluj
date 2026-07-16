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
    "h-[58px] w-full min-w-0 rounded-[22px] border border-[var(--koluj-border)] bg-white px-4 font-bold text-[var(--koluj-text)] outline-none shadow-sm focus:border-[var(--koluj-green)] focus:shadow-[0_0_0_4px_rgba(95,127,43,0.10)]";

  const visibleSelectCount = [
    onOfferTypeChange,
    onCategoryChange,
    onStatusChange,
    onSortByChange,
  ].filter(Boolean).length;

  const desktopGridClass =
    visibleSelectCount >= 4
      ? "xl:grid-cols-[minmax(280px,1fr)_170px_220px_210px_190px]"
      : visibleSelectCount === 3
        ? "xl:grid-cols-[minmax(280px,1fr)_170px_220px_190px]"
        : visibleSelectCount === 2
          ? "xl:grid-cols-[minmax(280px,1fr)_220px_190px]"
          : visibleSelectCount === 1
            ? "xl:grid-cols-[minmax(280px,1fr)_220px]"
            : "xl:grid-cols-1";

  return (
    <section className="koluj-card p-3 md:p-4">
      <div className={`grid gap-3 md:grid-cols-2 ${desktopGridClass}`}>
        <div className="flex h-[58px] min-w-0 items-center gap-3 rounded-[22px] border border-[var(--koluj-border)] bg-white px-4 shadow-sm focus-within:border-[var(--koluj-green)] focus-within:shadow-[0_0_0_4px_rgba(95,127,43,0.10)] md:col-span-2 xl:col-span-1">
          <Search size={21} className="shrink-0 text-[var(--koluj-muted)]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-4 text-base font-bold text-[var(--koluj-text)] outline-none placeholder:text-slate-400"
          />
        </div>

        {onOfferTypeChange && (
          <select
            aria-label="Typ nabídky"
            value={offerType}
            onChange={(event) => onOfferTypeChange(event.target.value)}
            className={selectClass}
          >
            {offerTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {onCategoryChange && (
          <select
            aria-label="Kategorie"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            className={selectClass}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {onStatusChange && (
          <select
            aria-label="Stav nabídky"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            className={selectClass}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {onSortByChange && (
          <select
            aria-label="Řazení"
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value)}
            className={selectClass}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </section>
  );
}
