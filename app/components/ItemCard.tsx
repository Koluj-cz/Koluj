import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import {
  categoryLabels,
  itemStatusClasses,
  itemStatusLabels,
} from "@/lib/constants";
import { translatePriceUnit } from "@/lib/format";

export type ItemCardItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  condition: string | null;
  pickup_place: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  price_amount: number | null;
  price_unit: string | null;
  primary_image_url: string | null;
  created_at: string;
  status: string | null;
  owner_id: string | null;
  loans?: { id: string; owner_earnings: number | null }[] | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    is_verified: boolean | null;
    profile_ratings?: {
      rating_avg: number | null;
      rating_count: number | null;
    }[] | null;
  } | null;
};

type ItemCardProps = {
  item: ItemCardItem;
  variant?: "public" | "owner";
  children?: React.ReactNode;
};

function shortPlace(place: string) {
  return (
    place
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(-2, -1)[0] || place
  );
}

export default function ItemCard({
  item,
  variant = "public",
  children,
}: ItemCardProps) {
  const status = item.status || "available";
  const statusLabel = itemStatusLabels[status] || status;
  const statusClass = itemStatusClasses[status] || itemStatusClasses.available;

  const ownerName = item.profiles?.full_name || "Uživatel";
  const rating = item.profiles?.profile_ratings?.[0];

  const ratingText =
    rating && rating.rating_count
      ? `★ ${Number(rating.rating_avg).toFixed(1)}`
      : "★ Nový";

  const loanCount = item.loans?.length || 0;

  const cardContent = (
    <>
      <div className="relative min-h-[280px] overflow-hidden rounded-[28px] bg-[var(--koluj-bg)] sm:min-h-[360px]">
        {item.primary_image_url ? (
          <img
            src={item.primary_image_url}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--koluj-bg)] text-sm text-[var(--koluj-muted)]">
            Bez fotky
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/12 to-black/55" />

        <span
          className={`koluj-status-badge absolute right-4 top-4 ${statusClass}`}
        >
          {statusLabel}
        </span>

        <div className="relative z-10 flex min-h-[280px] flex-col justify-between p-4 text-white sm:min-h-[360px] sm:p-5">
          <div>
            <h3 className="line-clamp-2 max-w-[75%] text-2xl font-black leading-none tracking-tight drop-shadow-sm">
              {item.title}
            </h3>

            <p className="mt-2 text-sm font-black text-[#cfe8a4]">
              {categoryLabels[item.category] || item.category}
            </p>

            <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-white/90">
              <MapPin size={16} />
              {shortPlace(item.pickup_place)}
            </p>

            {variant === "public" && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  if (item.owner_id) {
                    window.location.href = `/users/${item.owner_id}`;
                  }
                }}
                className="mt-4 flex items-center gap-3 text-left"
              >
                {item.profiles?.avatar_url ? (
                  <img
                    src={item.profiles.avatar_url}
                    alt={ownerName}
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-white/50"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm font-black text-[var(--koluj-green)]">
                    {ownerName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div>
                  <p className="font-black leading-tight text-white">
                    {ownerName}
                  </p>

                  <p className="text-sm font-black text-[#cfe8a4]">
                    {ratingText}
                  </p>
                </div>
              </button>
            )}

            {variant === "owner" && (
              <p className="mt-4 text-sm font-black text-white/90">
                {loanCount} půjčení
              </p>
            )}
          </div>

          {item.price_amount && item.price_unit && (
            <div className="w-fit rounded-2xl bg-[var(--koluj-green)] px-4 py-2 text-sm font-black text-white shadow-lg">
              {item.price_amount} Kč / {translatePriceUnit(item.price_unit)}
            </div>
          )}
        </div>
      </div>

      {variant === "owner" && children && (
        <div className="border-t border-[var(--koluj-border)] p-4">
          {children}
        </div>
      )}
    </>
  );

  if (variant === "owner") {
    return (
      <div className="koluj-card group flex h-full flex-col overflow-hidden p-1">
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      href={`/items/${item.id}`}
      className="koluj-card group block overflow-hidden p-1 transition hover:-translate-y-1"
    >
      {cardContent}
    </Link>
  );
}