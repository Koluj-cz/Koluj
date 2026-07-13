import { memo } from "react";
import Image from "next/image";
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
  availability_status?: "available" | "reserved" | "unavailable";
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
    <div className="flex h-full w-full items-center justify-center bg-[var(--koluj-green-pale)]">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-sm">
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

function OfferCard({ item, variant = "public", footer }: OfferCardProps) {
  const availabilityStatus = item.availability_status || (item.is_reserved_today ? "reserved" : "available");
  const isReserved = availabilityStatus === "reserved";
  const isUnavailable = availabilityStatus === "unavailable";
  const isService = item.offer_type === "service";
  const typeLabel = isService ? "Služba" : "Věc";
  const categoryLabel = isService
    ? serviceCategoryLabels[item.category] || item.category
    : categoryLabels[item.category] || item.category;

  const ownerName = item.profiles?.full_name || "Uživatel";
  const rating = item.profiles?.profile_ratings?.[0];
  const ratingText = rating && rating.rating_count ? `★ ${Number(rating.rating_avg).toFixed(1)}` : "★ Nový";
  const bookingCount = item.bookings?.length || 0;

  const priceBlock = item.price_unit === "individual" ? (
    <p className="shrink-0 text-right text-lg font-black text-[var(--koluj-green)]">
      Individuálně
    </p>
  ) : item.price_amount && item.price_unit ? (
    <div className="shrink-0 text-right">
      <p className="text-xl font-black tracking-[-0.04em] text-[var(--koluj-green)]">
        {item.price_amount} Kč
      </p>
      <p className="text-xs font-black text-[var(--koluj-muted)]">
        / {translatePriceUnit(item.price_unit, item.offer_type)}
      </p>
    </div>
  ) : (
    <p className="shrink-0 text-right text-lg font-black text-[var(--koluj-ink)]">
      Dohodou
    </p>
  );

  const content = (
    <article className="koluj-offer-card group/card flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--koluj-border)] bg-white shadow-[var(--koluj-shadow-soft)]">
      <div className="relative h-[190px] overflow-hidden bg-slate-100 sm:h-[210px]">
        {item.primary_image_url ? (
          <Image
            src={item.primary_image_url}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="object-cover"
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
            <span
              className={`rounded-full px-3 py-1 text-xs font-black shadow-sm ${
                isService
                  ? "bg-violet-100 text-violet-700"
                  : "bg-sky-100 text-sky-700"
              }`}
            >
              {typeLabel}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--koluj-muted)] shadow-sm">
              {categoryLabel}
            </span>
          </div>

          <span
            className={`koluj-status-badge shrink-0 ${
              isUnavailable
                ? "bg-stone-200 text-stone-700"
                : isReserved
                  ? "bg-orange-100 text-orange-700"
                  : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {isUnavailable ? "Nedostupné" : isReserved ? "Rezervované" : "Volné"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-lg font-black leading-tight tracking-[-0.03em] text-[var(--koluj-ink)]">
              {item.title}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-bold text-[var(--koluj-muted)]">
              <MapPin size={15} />
              {shortPlace(item.pickup_place)}
            </p>
          </div>

          {priceBlock}
        </div>

        {variant === "public" ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (item.owner_id) window.location.href = `/users/${item.owner_id}`;
            }}
            className="mt-4 flex items-center gap-2 text-left hover:text-[var(--koluj-green)]"
          >
            {item.profiles?.avatar_url ? (
              <Image src={item.profiles.avatar_url} alt={ownerName} width={32} height={32} className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
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

      {footer && <div className="bg-white/54 px-5 py-4">{footer}</div>}
    </article>
  );

  if (variant === "owner") {
    return <div className="h-full">{content}</div>;
  }

  return (
    <Link href={`/offers/${item.id}`} className="block h-full rounded-[22px]">
      {content}
    </Link>
  );
}

export default memo(OfferCard);
