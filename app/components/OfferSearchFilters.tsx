"use client";

import { LocateFixed, Search } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
};

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
  offerType,
  onOfferTypeChange,
  offerTypeOptions = [],
  category,
  onCategoryChange,
  categoryOptions = [],
  status,
  onStatusChange,
  statusOptions = [],
  sortBy,
  onSortByChange,
  sortOptions = [],
  onUseLocation,
  locationActive = false,
}: OfferSearchFiltersProps) {
  const controlsCount = [
    onOfferTypeChange,
    onCategoryChange,
    onStatusChange,
    onSortByChange,
  ].filter(Boolean).length;

  const gridClass =
    controlsCount >= 4
      ? "xl:grid-cols-[minmax(280px,1fr)_180px_230px_210px_190px]"
      : controlsCount === 3
        ? "xl:grid-cols-[minmax(280px,1fr)_220px_210px_190px]"
        : controlsCount === 2
          ? "xl:grid-cols-[minmax(280px,1fr)_220px_190px]"
          : controlsCount === 1
            ? "xl:grid-cols-[minmax(280px,1fr)_220px]"
            : "xl:grid-cols-1";

  const selectClass =
    "min-h-[58px] w-full rounded-2xl border border-[var(--koluj-border)] bg-white px-4 font-bold text-[var(--koluj-text)] outline-none transition focus:border-[var(--koluj-green)]";

  return (
    <section className="rounded-[28px] border border-[var(--koluj-border)] bg-white/80 p-3 shadow-sm backdrop-blur md:p-4">
      <div className={`grid gap-3 ${gridClass}`}>
        <div className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-[var(--koluj-border)] bg-white px-4 transition focus-within:border-[var(--koluj-green)]">
          <Search size={20} className="shrink-0 text-[var(--koluj-muted)]" />

          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-4 text-[var(--koluj-text)] outline-none placeholder:text-[var(--koluj-muted)]"
          />

          {onUseLocation && (
            <button
              type="button"
              onClick={onUseLocation}
              className={`hidden shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition sm:flex ${
                locationActive
                  ? "bg-[var(--koluj-green)] text-white"
                  : "bg-[var(--koluj-bg)] text-[var(--koluj-green)] hover:bg-white"
              }`}
            >
              <LocateFixed size={16} />
              Okolo mě
            </button>
          )}
        </div>

        {onOfferTypeChange && offerType !== undefined && (
          <select
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

        {onCategoryChange && category !== undefined && (
          <select
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

        {onStatusChange && status !== undefined && (
          <select
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

        {onSortByChange && sortBy !== undefined && (
          <select
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

      {onUseLocation && (
        <button
          type="button"
          onClick={onUseLocation}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3 font-bold transition sm:hidden ${
            locationActive
              ? "border-[var(--koluj-green)] bg-[var(--koluj-green)] text-white"
              : "border-[var(--koluj-border)] bg-white text-[var(--koluj-muted)] hover:bg-[var(--koluj-bg)]"
          }`}
        >
          <LocateFixed size={18} />
          Okolo mě
        </button>
      )}
    </section>
  );
}
