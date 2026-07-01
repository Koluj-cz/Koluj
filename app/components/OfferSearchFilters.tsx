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
  const selectCount = [
    onOfferTypeChange,
    onCategoryChange,
    onStatusChange,
    onSortByChange,
  ].filter(Boolean).length;

  const gridClass =
    selectCount >= 4
      ? "lg:grid-cols-[1fr_180px_220px_220px_200px]"
      : selectCount === 3
      ? "lg:grid-cols-[1fr_220px_220px_200px]"
      : selectCount === 2
      ? "lg:grid-cols-[1fr_220px_200px]"
      : selectCount === 1
      ? "lg:grid-cols-[1fr_220px]"
      : "lg:grid-cols-1";

  return (
    <section className="koluj-card p-3 md:p-4">
      <div className={`grid gap-3 ${gridClass}`}>
        <div className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-[var(--koluj-border)] bg-white px-4">
          <Search size={20} className="shrink-0 text-[var(--koluj-muted)]" />

          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
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
            className="koluj-input"
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
            className="koluj-input"
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
            className="koluj-input"
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
            className="koluj-input"
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
