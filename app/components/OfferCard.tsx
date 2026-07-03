import Link from "next/link";
import { Baby, Boxes, GraduationCap, Heart, Home, Laptop, MapPin, Star, Trees, Truck, Wrench } from "lucide-react";
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
    profile_ratings?: { rating_avg: number | null; rating_count: number | null }[] | null;
  } | null;
};

type OfferCardProps = {
  item: OfferCardOffer;
  variant?: "public" | "owner";
  footer?: React.ReactNode;
};

function ServiceFallbackImage({ category }: { category: string }) {
  const iconClass = "h-12 w-12 text-[var(--koluj-green)]";
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
    <div className="flex h-full w-full items-center justify-center bg-[var(--koluj-bg-soft)]">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white">
        {icon}
      </div>
    </div>
  );
}

function shortPlace(place: string) {
  return place.split(",").map((part) => part.trim()).filter(Boolean).slice(-2, -1)[0] || place;
}

export default function OfferCard({ item, variant = "public", footer }: OfferCardProps) {
  const isReserved = Boolean(item.is_reserved_today);
  const isService = item.offer_type === "service";
  const typeLabel = isService ? "Služba" : "Věc";
  const categoryLabel = isService ? serviceCategoryLabels[item.category] || item.category : categoryLabels[item.category] || item.category;
  const ownerName = item.profiles?.full_name || "Uživatel";
  const rating = item.profiles?.profile_ratings?.[0];
  const ratingText = rating && rating.rating_count ? Number(rating.rating_avg).toFixed(1) : "Nový";
  const bookingCount = item.bookings?.length || 0;

  const content = (
    <article className="group/card flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--koluj-border-strong)] bg-white p-2 transition duration-300 hover:-translate-y-1 hover:border-[rgba(47,93,58,0.28)]">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-[var(--koluj-bg-soft)]">
        {item.primary_image_url ? (
          <img src={item.primary_image_url} alt={item.title} className="h-full w-full object-cover transition duration-700 group-hover/card:scale-[1.035]" />
        ) : isService ? (
          <ServiceFallbackImage category={item.category} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-[var(--koluj-muted)]">Bez fotky</div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-[var(--koluj-ink)] backdrop-blur">{typeLabel}</span>
            <span className="hidden rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--koluj-muted)] backdrop-blur sm:inline-flex">{categoryLabel}</span>
          </div>
          <button type="button" aria-label="Uložit" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[var(--koluj-ink)] backdrop-blur transition hover:scale-105 hover:text-[var(--koluj-green)]">
            <Heart size={18} />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-[var(--koluj-green)] backdrop-blur">
          {isReserved ? "Dnes obsazeno" : "Dnes volné"}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-[1.18rem] font-semibold leading-tight tracking-[-0.035em] text-[var(--koluj-ink)]">{item.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-[var(--koluj-muted)]">
              <MapPin size={14} />
              {shortPlace(item.pickup_place)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {item.price_amount && item.price_unit ? (
              <>
                <p className="text-base font-semibold tracking-[-0.03em] text-[var(--koluj-ink)]">{item.price_amount} Kč</p>
                <p className="text-xs text-[var(--koluj-muted)]">/{translatePriceUnit(item.price_unit, item.offer_type)}</p>
              </>
            ) : (
              <p className="text-base font-semibold text-[var(--koluj-ink)]">Dohodou</p>
            )}
          </div>
        </div>

        {variant === "public" ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (item.owner_id) window.location.href = `/users/${item.owner_id}`;
            }}
            className="mt-3 flex items-center gap-2 text-left text-sm transition hover:text-[var(--koluj-green)]"
          >
            {item.profiles?.avatar_url ? (
              <img src={item.profiles.avatar_url} alt={ownerName} className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--koluj-green-soft)] text-xs font-semibold text-[var(--koluj-green)]">{ownerName.charAt(0).toUpperCase()}</div>
            )}
            <span className="truncate text-[var(--koluj-muted)]">{ownerName}</span>
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--koluj-ink)]"><Star size={13} fill="currentColor" />{ratingText}</span>
          </button>
        ) : (
          <p className="mt-3 text-sm font-semibold text-[var(--koluj-muted)]">{bookingCount} rezervací</p>
        )}
      </div>

      {footer && <div className="mt-4 border-t border-[var(--koluj-border)] pt-4">{footer}</div>}
    </article>
  );

  if (variant === "owner") return <div className="h-full">{content}</div>;
  return <Link href={`/offers/${item.id}`} className="block h-full rounded-[28px]">{content}</Link>;
}
