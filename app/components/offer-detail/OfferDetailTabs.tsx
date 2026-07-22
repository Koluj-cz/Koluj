"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, Play, Star, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { handoverLabels } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { ItemDetail, OfferReview, ServiceRealization } from "./types";

type TabId = "description" | "realizations" | "location" | "reviews";

type Props = {
  item: ItemDetail;
  realizations: ServiceRealization[];
  reviews: OfferReview[];
};

export default function OfferDetailTabs({ item, realizations, reviews }: Props) {
  const tabs = useMemo(
    () => [
      { id: "description" as const, label: "Popis" },
      ...(item.offer_type === "service"
        ? [{ id: "realizations" as const, label: `Realizace (${realizations.length})` }]
        : []),
      { id: "location" as const, label: "Lokalita" },
      { id: "reviews" as const, label: `Hodnocení (${reviews.length})` },
    ],
    [item.offer_type, realizations.length, reviews.length],
  );
  const [activeTab, setActiveTab] = useState<TabId>("description");

  return (
    <section className="koluj-card overflow-hidden">
      <div className="overflow-x-auto border-b border-[var(--koluj-border)] px-4 md:px-8">
        <div className="flex min-w-max gap-7">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative py-5 text-sm font-black transition md:text-base ${
                activeTab === tab.id
                  ? "text-[var(--koluj-green)]"
                  : "text-[var(--koluj-muted)] hover:text-[var(--koluj-text)]"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-t-full bg-[var(--koluj-green)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 md:p-8">
        {activeTab === "description" && <DescriptionTab item={item} />}
        {activeTab === "realizations" && (
          <RealizationsTab realizations={realizations} />
        )}
        {activeTab === "location" && <LocationTab item={item} />}
        {activeTab === "reviews" && <ReviewsTab reviews={reviews} />}
      </div>
    </section>
  );
}

function DescriptionTab({ item }: { item: ItemDetail }) {
  if (!item.description) {
    return <p className="font-bold text-[var(--koluj-muted)]">Popis nebyl doplněn.</p>;
  }
  return (
    <div
      className="koluj-rich-text text-lg leading-relaxed text-[var(--koluj-muted)]"
      dangerouslySetInnerHTML={{ __html: item.description }}
    />
  );
}

function RealizationsTab({ realizations }: { realizations: ServiceRealization[] }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [opened, setOpened] = useState<ServiceRealization | null>(null);
  const [openedMedia, setOpenedMedia] = useState(0);

  function scroll(direction: -1 | 1) {
    scroller.current?.scrollBy({ left: direction * 520, behavior: "smooth" });
  }

  if (realizations.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--koluj-bg)] p-5 font-bold text-[var(--koluj-muted)]">
        Poskytovatel zatím nepřidal žádné ukázky realizací.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Galerie realizací</h2>
          <p className="mt-2 text-[var(--koluj-muted)]">
            Ukázky předchozích zakázek. Každou realizaci lze upravit podle požadavků zákazníka.
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button type="button" onClick={() => scroll(-1)} className="rounded-full border border-[var(--koluj-border)] p-2.5" aria-label="Předchozí realizace">
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={() => scroll(1)} className="rounded-full border border-[var(--koluj-border)] p-2.5" aria-label="Další realizace">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {realizations.map((realization) => (
          <button
            key={realization.id}
            type="button"
            onClick={() => {
              setOpened(realization);
              setOpenedMedia(0);
            }}
            className="flex w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[var(--koluj-border)] bg-white text-left transition hover:border-[var(--koluj-green)] sm:w-[390px]"
          >
            <div className="relative h-40 w-36 shrink-0 bg-[var(--koluj-bg)] sm:w-44">
              {realization.images[0]?.image_url && (
                <Image src={realization.images[0].image_url} alt={realization.title} fill sizes="176px" className="object-cover" />
              )}
              {realization.videos.length > 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-black/70 p-2 text-white"><Play size={15} fill="currentColor" /></span>
              )}
              {realization.images.length + realization.videos.length > 1 && (
                <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs font-black text-white">
                  +{realization.images.length + realization.videos.length - 1}
                </span>
              )}
            </div>
            <div className="min-w-0 p-4">
              <h3 className="font-black">{realization.title}</h3>
              {realization.description && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--koluj-muted)]">
                  {realization.description}
                </p>
              )}
              {realization.indicative_price_from !== null && (
                <p className="mt-3 text-sm font-black text-[var(--koluj-green)]">
                  Orientačně od {realization.indicative_price_from} Kč
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {opened && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 md:p-7">
            <button type="button" onClick={() => setOpened(null)} className="absolute right-4 top-4 z-10 rounded-full bg-white p-2 shadow" aria-label="Zavřít realizaci">
              <X size={22} />
            </button>
            {(() => {
              const media = [
                ...opened.images.map((image) => ({ type: "image" as const, url: image.image_url, poster: null })),
                ...opened.videos.map((video) => ({ type: "video" as const, url: video.video_url, poster: video.thumbnail_url })),
              ];
              const current = media[openedMedia] || media[0];
              return (
                <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
                  {current?.type === "image" && <Image src={current.url} alt={opened.title} fill sizes="900px" className="object-contain" />}
                  {current?.type === "video" && <video src={current.url} poster={current.poster || undefined} controls autoPlay playsInline className="h-full w-full object-contain" />}
                  {media.length > 1 && (
                    <>
                      <button type="button" onClick={() => setOpenedMedia((value) => (value - 1 + media.length) % media.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow" aria-label="Předchozí médium"><ChevronLeft /></button>
                      <button type="button" onClick={() => setOpenedMedia((value) => (value + 1) % media.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow" aria-label="Další médium"><ChevronRight /></button>
                    </>
                  )}
                </div>
              );
            })()}
            <h3 className="mt-5 text-2xl font-black">{opened.title}</h3>
            {opened.description && <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">{opened.description}</p>}
            {opened.indicative_price_from !== null && (
              <p className="mt-4 font-black text-[var(--koluj-green)]">Orientačně od {opened.indicative_price_from} Kč</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function LocationTab({ item }: { item: ItemDetail }) {
  const hasCoordinates = Number.isFinite(Number(item.pickup_latitude)) && Number.isFinite(Number(item.pickup_longitude));
  const mapHref = hasCoordinates
    ? `https://mapy.cz/zakladni?x=${item.pickup_longitude}&y=${item.pickup_latitude}&z=14`
    : `https://mapy.cz/zakladni?q=${encodeURIComponent(item.pickup_place)}`;

  return (
    <div>
      <div className="flex items-start gap-4">
        <span className="koluj-icon-bubble"><MapPin size={22} /></span>
        <div>
          <h2 className="text-2xl font-black">Předání a lokalita</h2>
          <p className="mt-2 text-lg font-bold text-[var(--koluj-muted)]">{item.pickup_place}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {item.offer_type !== "service" && (
          <InfoBlock
            title="Možnosti předání"
            text={item.handover_options?.length
              ? item.handover_options.map((option) => handoverLabels[option] || option).join(", ")
              : "Domluvou"}
          />
        )}
        {item.contact_note && <InfoBlock title="Poznámka" text={item.contact_note} />}
      </div>

      <a href={mapHref} target="_blank" rel="noreferrer" className="koluj-button mt-6 inline-flex items-center gap-2 px-5 py-3">
        Otevřít v Mapy.cz <ExternalLink size={17} />
      </a>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-[var(--koluj-bg)] p-5">
      <p className="font-black">{title}</p>
      <p className="mt-2 text-[var(--koluj-muted)]">{text}</p>
    </div>
  );
}

function ReviewsTab({ reviews }: { reviews: OfferReview[] }) {
  if (reviews.length === 0) {
    return <p className="rounded-2xl bg-[var(--koluj-bg)] p-5 font-bold text-[var(--koluj-muted)]">Vlastník zatím nemá žádné hodnocení.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reviews.map((review) => (
        <article key={review.id} className="rounded-2xl border border-[var(--koluj-border)] p-5">
          <div className="flex items-center gap-3">
            {review.reviewer?.avatar_url ? (
              <Image src={review.reviewer.avatar_url} alt="" width={42} height={42} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--koluj-bg)] font-black text-[var(--koluj-green)]">
                {(review.reviewer?.full_name || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-black">{review.reviewer?.full_name || "Uživatel"}</p>
              <p className="text-sm text-[var(--koluj-muted)]">{formatDate(review.created_at)}</p>
            </div>
          </div>
          <p className="mt-4 flex gap-1 text-amber-500" aria-label={`${review.rating} z 5 hvězd`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} size={17} fill={index < review.rating ? "currentColor" : "none"} />
            ))}
          </p>
          {review.comment && <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">{review.comment}</p>}
        </article>
      ))}
    </div>
  );
}
