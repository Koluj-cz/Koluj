import Link from "next/link";
import {
  Baby,
  Boxes,
  GraduationCap,
  Heart,
  Home,
  Laptop,
  MapPin,
  Trees,
  Truck,
  Wrench,
} from "lucide-react";
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
  const iconClass = "h-14 w-14 text-[var(--koluj-green)]";
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
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_40%_20%,white,var(--koluj-green-soft)_58%,var(--koluj-bg))]">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/85 shadow-[0_18px_42px_rgba(40,42,30,0.12)]">
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

export default function OfferCard({ item, variant = "public", footer }: OfferCardProps) {
  const isReserved = Boolean(item.is_reserved_today);
  const isService = item.offer_type === "service";
  const typeLabel = isService ? "Služba" : "Věc";
  const categoryLabel = isService
    ? serviceCategoryLabels[item.category] || item.category
    : categoryLabels[item.category] || item.category;

  const ownerName = item.profiles?.full_name || "Uživatel";
  const rating = item.profiles?.profile_ratings?.[0];
  const ratingText = rating && rating.rating_count ? `★ ${Number(rating.rating_avg).toFixed(1)}` : "★ Nový";
  const bookingCount = item.bookings?.length || 0;

  const content = (
    <article className="group/card flex h-full flex-col overflow-hidden rounded-[30px] bg-white/88 shadow-[0_18px_46px_rgba(35,37,27,0.11)] ring-1 ring-black/[0.045] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(35,37,27,0.15)]">
      <div className="relative h-[210px] overflow-hidden bg-[var(--koluj-bg)] sm:h-[240px]">
        {item.primary_image_url ? (
          <img
            src={item.primary_image_url}
            alt={item.title}
            className="h-full w-full object-cover transition duration-700 group-hover/card:scale-105"
          />
        ) : isService ? (
          <ServiceFallbackImage category={item.category} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-bold text-[var(--koluj-muted)]">
            Bez fotky
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black shadow-sm ${isService ? "bg-violet-100 text-violet-700" : "bg-white text-[var(--koluj-green)]"}`}>
              {typeLabel}
            </span>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[var(--koluj-muted)] shadow-sm backdrop-blur">
              {categoryLabel}
            </span>
          </div>

          <span className={`koluj-status-badge shrink-0 ${isReserved ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-800"}`}>
            {isReserved ? "Rezervované" : "Volné"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[1.35rem] font-black leading-tight tracking-[-0.045em] text-[var(--koluj-ink)]">
              {item.title}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-bold text-[var(--koluj-muted)]">
              <MapPin size={15} />
              {shortPlace(item.pickup_place)}
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          {item.price_amount && item.price_unit ? (
            <div>
              <p className="text-xl font-black tracking-[-0.04em] text-[var(--koluj-ink)]">{item.price_amount} Kč</p>
              <p className="text-xs font-black text-[var(--koluj-muted)]">/ {translatePriceUnit(item.price_unit, item.offer_type)}</p>
            </div>
          ) : (
            <p className="text-xl font-black text-[var(--koluj-ink)]">Dohodou</p>
          )}
        </div>

        {variant === "public" ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (item.owner_id) window.location.href = `/users/${item.owner_id}`;
            }}
            className="mt-4 flex items-center gap-2 text-left transition hover:text-[var(--koluj-green)]"
          >
            {item.profiles?.avatar_url ? (
              <img src={item.profiles.avatar_url} alt={ownerName} className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--koluj-green-soft)] text-xs font-black text-[var(--koluj-green)]">
                {ownerName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="truncate font-black text-[var(--koluj-text)]">{ownerName}</span>
            <span className="font-black text-[var(--koluj-green)]">{ratingText}</span>
          </button>
        ) : (
          <p className="mt-4 font-black text-[var(--koluj-muted)]">{bookingCount} rezervací</p>
        )}
      </div>

      {footer && <div className="border-t border-[var(--koluj-border)] bg-white/54 px-5 py-4">{footer}</div>}
    </article>
  );

  if (variant === "owner") {
    return <div className="h-full">{content}</div>;
  }

  return (
    <Link href={`/offers/${item.id}`} className="block h-full rounded-[30px]">
      {content}
    </Link>
  );
}
