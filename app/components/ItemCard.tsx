import Link from "next/link";
import { MapPin, Star } from "lucide-react";

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
  loans?: {
    id: string;
    owner_earnings: number | null;
  }[] | null;
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

const categoryLabels: Record<string, string> = {
  naradi: "Nářadí",
  elektronika: "Elektronika",
  sport: "Sport",
  outdoor: "Outdoor",
  dum_zahrada: "Dům a zahrada",
  auto_moto: "Auto/Moto",
  foto_video: "Foto a video",
  party_akce: "Party a akce",
  ostatni: "Ostatní",
};

const conditionLabels: Record<string, string> = {
  new: "Nové",
  like_new: "Jako nové",
  good: "Dobrý stav",
  used: "Běžně používané",
};

const statusLabels: Record<string, string> = {
  available: "Volné",
  reserved: "Rezervované",
  borrowed: "Půjčené",
};

const statusClasses: Record<string, string> = {
  available: "koluj-status-available",
  reserved: "koluj-status-reserved",
  borrowed: "koluj-status-borrowed",
};

function translatePriceUnit(unit: string | null) {
  if (unit === "hour") return "hodinu";
  if (unit === "day") return "den";
  if (unit === "weekend") return "víkend";
  if (unit === "week") return "týden";
  if (unit === "month") return "měsíc";
  if (unit === "piece") return "půjčení";
  return "";
}

function stripHtml(value: string | null) {
  if (!value) return "";

  return value.replace(/<[^>]*>/g, "").trim();
}

function shortPlace(place: string) {
  return place
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(-2, -1)[0] || place;
}

export default function ItemCard({
  item,
  variant = "public",
  children,
}: ItemCardProps) {
  const status = item.status || "available";
  const statusLabel = statusLabels[status] || status;
  const statusClass = statusClasses[status] || statusClasses.available;

  const ownerName = item.profiles?.full_name || "Uživatel";
  const rating = item.profiles?.profile_ratings?.[0];

  const ratingText =
    rating && rating.rating_count
      ? `★ ${Number(rating.rating_avg).toFixed(1)}`
      : "★ Nový";

  const ratingCountText =
    rating && rating.rating_count ? `(${rating.rating_count})` : "";

  const loanCount = item.loans?.length || 0;

  const ownerEarnings = (item.loans || []).reduce(
    (sum, loan) => sum + Number(loan.owner_earnings || 0),
    0
  );

  const cardContent = (
    <>
      <div className="relative h-36 overflow-hidden bg-[var(--koluj-bg)] sm:h-44">
        {item.primary_image_url ? (
          <img
            src={item.primary_image_url}
            alt={item.title}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--koluj-muted)]">
            Bez fotky
          </div>
        )}

        <span
          className={`koluj-status-badge absolute right-3 top-3 ${statusClass}`}
        >
          {statusLabel}
        </span>

        {item.price_amount && item.price_unit && (
          <div className="absolute bottom-3 left-3 rounded-xl bg-[var(--koluj-green)] px-3 py-1.5 text-xs font-black text-white">
            {item.price_amount} Kč / {translatePriceUnit(item.price_unit)}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div>
          <h3 className="truncate text-lg font-black sm:text-xl">{item.title}</h3>

          <p className="mt-1 text-sm font-bold text-[var(--koluj-green)]">
            {categoryLabels[item.category] || item.category}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--koluj-muted)]">
          <span className="flex items-center gap-1.5">
            <MapPin size={15} />
            {shortPlace(item.pickup_place)}
          </span>

          {item.condition && (
            <span className="flex items-center gap-1.5">
              <Star size={15} />
              {conditionLabels[item.condition] || item.condition}
            </span>
          )}
        </div>

        {variant === "owner" && 
          <p className="mt-3 text-sm font-bold text-[var(--koluj-muted)]">
            {loanCount} půjčení
          </p>
        }

        {variant === "public" && (
          <div className="mt-auto flex items-center justify-between border-t border-[var(--koluj-border)] pt-4">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                if (item.owner_id) {
                  window.location.href = `/users/${item.owner_id}`;
                }
              }}
              className="flex items-center gap-3 text-left transition hover:text-[var(--koluj-green)]"
            >
              {item.profiles?.avatar_url ? (
                <img
                  src={item.profiles.avatar_url}
                  alt={ownerName}
                  className="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-sm font-black text-[var(--koluj-green)]">
                  {ownerName.charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <p className="font-black leading-tight">{ownerName}</p>

                <p className="text-sm font-bold text-[var(--koluj-green)]">
                  {ratingText}
                  {ratingCountText && (
                    <span className="ml-1 text-[var(--koluj-muted)]">
                      {ratingCountText}
                    </span>
                  )}
                </p>
              </div>
            </button>
          </div>
        )}
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
      <div className="koluj-card flex h-full flex-col overflow-hidden">
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      href={`/items/${item.id}`}
      className="koluj-card flex h-full flex-col overflow-hidden transition hover:-translate-y-1"
    >
      {cardContent}
    </Link>
  );
}