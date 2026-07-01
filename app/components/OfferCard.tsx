import Link from "next/link";
import { Baby, Boxes, GraduationCap, Home, Laptop, MapPin, Trees, Truck, Wrench } from "lucide-react";
import { categoryLabels, serviceCategoryLabels } from "@/lib/constants";
import { translatePriceUnit } from "@/lib/format";

export type OfferCardOffer = {
  id: string;
  title: string;
  description: string | null;
  offer_type?: "item" | "service" | string | null;
  category: string;
  condition: string | null;
  pickup_place: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  price_amount: number | null;
  price_unit: string | null;
  primary_image_url: string | null;
  created_at: string;
  status?: string | null;
  is_reserved_today?: boolean;
  owner_id: string | null;
  bookings?: { id: string; owner_earnings: number | null }[] | null;
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

type OfferCardProps = {
  item: OfferCardOffer;
  variant?: "public" | "owner";
  footer?: React.ReactNode;
};

function ServiceFallbackImage({ category }: { category: string }) {
  const iconClass = "h-16 w-16 text-[var(--koluj-green)]";
  const icon =
    category === "domacnost" ? <Home className={iconClass} /> :
    category === "zahrada" ? <Trees className={iconClass} /> :
    category === "stehovani" ? <Truck className={iconClass} /> :
    category === "doucovani" ? <GraduationCap className={iconClass} /> :
    category === "it" ? <Laptop className={iconClass} /> :
    category === "hlidani" ? <Baby className={iconClass} /> :
    category === "ostatni_sluzby" ? <Boxes className={iconClass} /> :
    <Wrench className={iconClass} />;

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--koluj-bg)] to-white">
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-sm">
        {icon}
      </div>
    </div>
  );
}

function shortPlace(place: string) {
  return (
    place
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(-2, -1)[0] || place
  );
}

export default function OfferCard({
  item,
  variant = "public",
  footer,
}: OfferCardProps) {
  const isReserved = Boolean(item.is_reserved_today);
  const statusLabel = isReserved ? "Rezervované" : "Volné";
  const statusClass = isReserved
    ? "bg-red-100 text-red-700"
    : "bg-emerald-100 text-emerald-800";

  const isService = item.offer_type === "service";
  const categoryLabel = isService
    ? serviceCategoryLabels[item.category] || item.category
    : categoryLabels[item.category] || item.category;

  const ownerName = item.profiles?.full_name || "Uživatel";
  const rating = item.profiles?.profile_ratings?.[0];

  const ratingText =
    rating && rating.rating_count
      ? `★ ${Number(rating.rating_avg).toFixed(1)}`
      : "★ Nový";

  const bookingCount = item.bookings?.length || 0;

  const cardContent = (
    <div className="flex h-full flex-col overflow-hidden rounded-[30px] bg-[var(--koluj-surface)] shadow-[0_16px_40px_rgba(31,31,26,0.12)]">
      <div className="p-4 sm:p-5">
        <p className="text-sm font-black text-[var(--koluj-green)]">
          {categoryLabel}
        </p>

        <h3 className="mt-1 overflow-hidden whitespace-nowrap text-ellipsis text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
          {item.title}
        </h3>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm font-bold text-[var(--koluj-muted)]">
          <span className="flex items-center gap-1.5">
            <MapPin size={16} />
            {shortPlace(item.pickup_place)}
          </span>

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
              className="flex items-center gap-2 text-left transition hover:text-[var(--koluj-green)]"
            >
              {item.profiles?.avatar_url ? (
                <img
                  src={item.profiles.avatar_url}
                  alt={ownerName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-xs font-black text-[var(--koluj-green)]">
                  {ownerName.charAt(0).toUpperCase()}
                </div>
              )}

              <span className="font-black text-[var(--koluj-text)]">
                {ownerName}
              </span>

              <span className="font-black text-[var(--koluj-green)]">
                {ratingText}
              </span>
            </button>
          )}

          {variant === "owner" && (
            <span className="font-black">{bookingCount} rezervací</span>
          )}
        </div>
      </div>

      <div className="relative h-[260px] overflow-hidden bg-[var(--koluj-bg)] sm:h-[320px]">
        {item.primary_image_url ? (
          <img
            src={item.primary_image_url}
            alt={item.title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : isService ? (
          <ServiceFallbackImage category={item.category} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--koluj-muted)]">
            Bez fotky
          </div>
        )}

        {item.price_amount && item.price_unit && (
          <div className="absolute bottom-4 left-4 rounded-2xl bg-[var(--koluj-green)] px-4 py-2 text-sm font-black text-white shadow-lg">
            {item.price_amount} Kč / {translatePriceUnit(item.price_unit)}
          </div>
        )}

        <span
          className={`koluj-status-badge absolute bottom-4 right-4 ${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>

      {footer && (
        <div className="bg-[var(--koluj-surface)] px-5 py-4">
          {footer}
        </div>
      )}
    </div>
  );

  if (variant === "owner") {
    return (
      <div className="group flex h-full flex-col overflow-hidden rounded-[30px]">
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      href={`/offers/${item.id}`}
      className="group block h-full overflow-hidden rounded-[30px] transition hover:-translate-y-1"
    >
      {cardContent}
    </Link>
  );
}
