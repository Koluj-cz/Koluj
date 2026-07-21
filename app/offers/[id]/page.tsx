"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PageLoader from "@/app/components/PageLoader";
import BackLink from "@/app/components/BackLink";
import {
  categoryLabels,
  conditionLabels,
  serviceCategoryLabels,
} from "@/lib/constants";
import { formatDate, formatDateTime, translatePriceUnit } from "@/lib/format";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Paperclip,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  HandoverCard,
  MetaAndDescriptionCard,
  OwnerCard,
} from "@/app/components/offer-detail/OfferDetailCards";
import type {
  ItemDetail,
  ItemImage,
  ItemVideo,
} from "@/app/components/offer-detail/types";
import OfferGallery from "@/app/components/offer-gallery/OfferGallery";

const AvailabilityCalendar = dynamic(
  () => import("@/app/components/AvailabilityCalendar"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-3xl border border-[var(--koluj-border)] bg-white p-5 text-sm font-bold text-[var(--koluj-muted)]">
        Kalendář dostupnosti se načítá...
      </div>
    ),
  },
);

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.id as string;

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [images, setImages] = useState<ItemImage[]>([]);
  const [videos, setVideos] = useState<ItemVideo[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);

  const [borrowFrom, setBorrowFrom] = useState("");
  const [borrowTo, setBorrowTo] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [borrowNote, setBorrowNote] = useState("");
  const [borrowAttachment, setBorrowAttachment] = useState<File | null>(null);
  const [submittingBorrowRequest, setSubmittingBorrowRequest] = useState(false);

  const loadPage = useCallback(async () => {
    try {
      const response = await fetch(`/api/offers/${offerId}`, {
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.item) {
        toast.error(result?.error || "Nabídku se nepodařilo načíst");
        router.push("/");
        return;
      }

      setCurrentUserId(result.currentUserId || null);
      setItem(result.item as ItemDetail);
      setImages(result.images || []);
      setVideos(result.videos || []);
    } catch (error) {
      console.error("Unexpected item detail error:", error);
      toast.error("Detail nabídky se nepodařilo načíst");
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [offerId, router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const updateLayout = () => setIsDesktopLayout(mediaQuery.matches);

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);

    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  async function handleBorrowClick() {
    if (!item || submittingBorrowRequest) return;

    if (!currentUserId) {
      router.push(
        `/login?redirectTo=${encodeURIComponent(`/offers/${item.id}`)}`,
      );
      return;
    }

    setSubmittingBorrowRequest(true);

    const requestData = new FormData();
    requestData.append("offerId", item.id);
    requestData.append(
      "dateFrom",
      item.offer_type === "service" && item.service_booking_mode !== "deadline"
        ? ""
        : borrowFrom,
    );
    requestData.append(
      "dateTo",
      item.offer_type === "service" && item.service_booking_mode !== "deadline"
        ? ""
        : borrowTo,
    );
    requestData.append(
      "startsAt",
      item.offer_type === "service" && item.service_booking_mode !== "deadline"
        ? startsAt
        : "",
    );
    requestData.append(
      "endsAt",
      item.offer_type === "service" && item.service_booking_mode !== "deadline"
        ? endsAt
        : "",
    );
    requestData.append("note", borrowNote);
    if (borrowAttachment) requestData.append("attachment", borrowAttachment);

    const response = await fetch("/api/bookings/request", {
      method: "POST",
      body: requestData,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setSubmittingBorrowRequest(false);
      toast.error(result?.error || "Žádost se nepodařilo vytvořit");

      if (
        result?.error ===
        "Nejdřív dokonči profil, aby bylo jasné, s kým a kde se nabídku předává."
      ) {
        router.push("/profile");
      }

      return;
    }

    toast.success("Žádost o rezervaci byla odeslána");
    router.push(`/dashboard/bookings/${result.bookingId}`);
  }

  const isOwner = item?.owner_id && currentUserId === item.owner_id;

  const rating = item?.profiles?.profile_ratings?.[0];

  const ratingText =
    rating && rating.rating_count
      ? `★ ${Number(rating.rating_avg).toFixed(1)}`
      : "★ Nový";

  const ratingCountText =
    rating && rating.rating_count ? `(${rating.rating_count})` : "";

  const selectedDays = useMemo(() => {
    if (!borrowFrom || !borrowTo) return null;

    const from = new Date(borrowFrom);
    const to = new Date(borrowTo);
    const diff = Math.round(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    );

    return diff >= 0 ? diff + 1 : null;
  }, [borrowFrom, borrowTo]);

  const isTimedService =
    item?.offer_type === "service" && item?.service_booking_mode !== "deadline";
  const isRequestOnlyService =
    item?.offer_type === "service" && item?.service_booking_mode === "deadline";

  const selectedServiceMinutes = useMemo(() => {
    if (!startsAt || !endsAt) return null;
    const minutes = Math.round(
      (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000,
    );
    return minutes > 0 ? minutes : null;
  }, [startsAt, endsAt]);

  const selectedServicePrice = useMemo(() => {
    if (!item || item.price_unit !== "hour" || !selectedServiceMinutes)
      return null;
    return (
      Math.round(
        Number(item.price_amount || 0) * (selectedServiceMinutes / 60) * 100,
      ) / 100
    );
  }, [item, selectedServiceMinutes]);

  if (loading) {
    return (
      <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
        <PageLoader />
      </main>
    );
  }

  if (!item) return null;

  const isService = item.offer_type === "service";

  const handoverCard = <HandoverCard item={item} />;
  const ownerCard = (
    <OwnerCard
      item={item}
      ratingText={ratingText}
      ratingCountText={ratingCountText}
    />
  );

  const bookingPanel = (
    <div className="koluj-card p-5 md:p-8">
      <div className="rounded-3xl bg-[var(--koluj-bg)] p-5">
        <p className="text-sm font-bold text-[var(--koluj-muted)]">Cena</p>

        <p className="mt-2 text-4xl font-black">
          {item.price_unit === "individual"
            ? "Individuálně"
            : item.price_amount
              ? `${item.price_amount} Kč`
              : "Dohodou"}
        </p>

        {item.price_unit && item.price_unit !== "individual" && (
          <p className="mt-1 font-bold text-[var(--koluj-green)]">
            za {translatePriceUnit(item.price_unit, item.offer_type)}
          </p>
        )}

        {!isService && item.deposit !== null && item.deposit !== undefined && (
          <p className="mt-3 text-sm font-bold text-[var(--koluj-muted)]">
            Kauce: {item.deposit} Kč
          </p>
        )}
      </div>

      {item.price_note && (
        <p className="mt-5 rounded-2xl border border-[var(--koluj-border)] p-4 text-sm text-[var(--koluj-muted)]">
          {item.price_note}
        </p>
      )}

      <div className="mt-6">
        <AvailabilityCalendar
          offerId={item.id}
          offerType={item.offer_type}
          serviceBookingMode={item.service_booking_mode}
          serviceHoursMode={item.service_hours_mode}
          weekdayStartTime={item.weekday_start_time}
          weekdayEndTime={item.weekday_end_time}
          weekendStartTime={item.weekend_start_time}
          weekendEndTime={item.weekend_end_time}
          showDeadlineSelectionSummary={false}
          isOwner={Boolean(isOwner)}
          selectedRange={
            (!isService || isRequestOnlyService) && borrowFrom && borrowTo
              ? { dateFrom: borrowFrom, dateTo: borrowTo }
              : null
          }
          selectedSlot={
            isTimedService && startsAt && endsAt ? { startsAt, endsAt } : null
          }
          onRangeChange={(range) => {
            setBorrowFrom(range?.dateFrom || "");
            setBorrowTo(range?.dateTo || "");
          }}
          onSlotChange={(slot) => {
            setStartsAt(slot?.startsAt || "");
            setEndsAt(slot?.endsAt || "");
          }}
        />
      </div>

      <div className="mt-5 rounded-3xl bg-[var(--koluj-bg)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-black">
              {isRequestOnlyService && !isOwner ? "Poptávka" : "Vybraný termín"}
            </p>

            {isTimedService && startsAt && endsAt ? (
              <div className="mt-3 space-y-1">
                <p className="text-lg font-black">
                  {formatDateTime(startsAt)} <span className="mx-2">→</span>{" "}
                  {formatDateTime(endsAt)}
                </p>
                {selectedServiceMinutes && (
                  <p className="font-bold text-[var(--koluj-muted)]">
                    {selectedServiceMinutes / 60} h
                    {selectedServicePrice !== null
                      ? ` · celkem ${selectedServicePrice} Kč`
                      : ""}
                  </p>
                )}
              </div>
            ) : (!isService || isRequestOnlyService) &&
              borrowFrom &&
              borrowTo ? (
              <p className="mt-3 text-lg font-black">
                {formatDate(borrowFrom)} <span className="mx-2">→</span>{" "}
                {formatDate(borrowTo)}
              </p>
            ) : (
              <p className="mt-3 text-[var(--koluj-muted)]">
                {isRequestOnlyService
                  ? "Vyber požadovaný termín dokončení."
                  : isService && !isRequestOnlyService
                    ? "Zatím není vybraný žádný čas."
                    : "Zatím není vybraný žádný termín."}
              </p>
            )}
          </div>

          {(!isService || isRequestOnlyService) && selectedDays && (
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black text-[var(--koluj-green)]">
              {selectedDays} {selectedDays === 1 ? "den" : "dní"}
            </span>
          )}
        </div>

        {((isTimedService && startsAt && endsAt) ||
          ((!isService || isRequestOnlyService) && borrowFrom && borrowTo)) && (
          <button
            type="button"
            onClick={() => {
              setBorrowFrom("");
              setBorrowTo("");
              setStartsAt("");
              setEndsAt("");
            }}
            className="mt-3 text-sm font-black text-[var(--koluj-green)] underline-offset-4 hover:underline"
          >
            Zrušit výběr
          </button>
        )}
      </div>

      {isOwner && (
        <Link
          href={`/offers/${item.id}/edit`}
          prefetch={false}
          className="koluj-button mt-6 flex w-full items-center justify-center gap-2 px-6 py-4"
        >
          <Edit size={18} />
          Upravit vlastní nabídku
        </Link>
      )}

      {!isOwner && (
        <>
          <div className="mt-6 grid gap-3">
            <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
              <textarea
                value={borrowNote}
                maxLength={500}
                disabled={submittingBorrowRequest}
                onChange={(event) => setBorrowNote(event.target.value)}
                placeholder="Napište zprávu pro majitele..."
                className="koluj-input min-h-[120px] disabled:opacity-70"
              />
            </label>

            <p className="text-right text-xs text-[var(--koluj-muted)]">
              {borrowNote.length}/500
            </p>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--koluj-border)] bg-white px-4 py-3 text-sm font-black text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]">
              <Paperclip size={18} />
              Přiložit soubor
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.zip"
                className="hidden"
                disabled={submittingBorrowRequest}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  if (file && file.size > 15 * 1024 * 1024) {
                    toast.error("Příloha může mít maximálně 15 MB");
                    event.currentTarget.value = "";
                    return;
                  }
                  setBorrowAttachment(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>

            {borrowAttachment && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--koluj-bg)] px-4 py-3 text-sm">
                <span className="min-w-0 truncate font-bold">
                  {borrowAttachment.name}
                </span>
                <button
                  type="button"
                  onClick={() => setBorrowAttachment(null)}
                  className="shrink-0 text-red-600"
                  aria-label="Odebrat přílohu"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleBorrowClick}
            disabled={
              submittingBorrowRequest ||
              (isTimedService
                ? !startsAt || !endsAt || startsAt === endsAt
                : !isService
                  ? !borrowFrom || !borrowTo
                  : false)
            }
            className="koluj-button mt-6 w-full px-6 py-4 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submittingBorrowRequest
              ? "Odesílám žádost..."
              : isTimedService && startsAt && endsAt && startsAt !== endsAt
                ? "Objednat službu"
                : isRequestOnlyService && borrowFrom
                  ? "Odeslat poptávku"
                  : !isService && borrowFrom && borrowTo
                    ? "Půjčit si"
                    : isTimedService
                      ? "Vyber čas"
                      : isRequestOnlyService
                        ? "Vyber termín dokončení"
                        : "Vyber termín"}
          </button>
        </>
      )}

      <div className="mt-6 flex gap-3 rounded-2xl bg-[var(--koluj-bg)] p-4 text-sm font-bold text-[var(--koluj-muted)]">
        <ShieldCheck size={20} className="shrink-0 text-[var(--koluj-green)]" />
        {isService
          ? "Po odeslání poptávky se domluvte s poskytovatelem na průběhu služby, ceně a všech detailech."
          : "Domluv se s vlastníkem na detailech. Platbu a předání věci řešte bezpečně a férově."}
      </div>
    </div>
  );

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="grid items-start gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-w-0 space-y-6">
            <div className="min-w-0">
              <div className="overflow-hidden rounded-[34px] bg-[var(--koluj-surface)] shadow-[0_18px_55px_rgba(31,31,26,0.12)]">
                {(images.length > 0 || item.offer_type !== "service") && (
                  <div className="relative">
                    <div className="absolute left-5 top-5 z-20 hidden md:block">
                      <BackLink href="/">Domů</BackLink>
                    </div>

                    <OfferGallery
                      title={item.title}
                      images={[...images]
                        .sort((a, b) => {
                          if (a.image_url === item.primary_image_url) return -1;
                          if (b.image_url === item.primary_image_url) return 1;
                          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
                        })
                        .map((image) => ({
                          id: image.id,
                          src: image.image_url,
                          alt: item.title,
                        }))}
                    />

                  </div>
                )}

                <div className="border-t border-[var(--koluj-border)] px-5 py-6 md:px-8 md:py-7">
                  <h1 className="max-w-4xl text-4xl font-black leading-none tracking-tight md:text-6xl">
                    {item.title}
                  </h1>

                  <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold text-[var(--koluj-muted)] md:text-base">
                    {item.condition && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-3 py-1.5">
                        <ShieldCheck
                          size={16}
                          className="text-[var(--koluj-green)]"
                        />
                        {conditionLabels[item.condition] || item.condition}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-3 py-1.5">
                      <Tag size={16} className="text-[var(--koluj-green)]" />
                      {item.offer_type === "service"
                        ? serviceCategoryLabels[item.category] || item.category
                        : categoryLabels[item.category] || item.category}
                    </span>

                    {item.created_at && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-3 py-1.5">
                        <CalendarDays
                          size={16}
                          className="text-[var(--koluj-green)]"
                        />
                        Přidáno {formatDate(item.created_at)}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-3 py-1.5">
                      <Eye size={16} className="text-[var(--koluj-green)]" />
                      {item.views_count ?? 0} zobrazení
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {videos.length > 0 && (
              <OfferVideoGallery title={item.title} videos={videos} />
            )}

            <div className="min-w-0">
              <MetaAndDescriptionCard item={item} />
            </div>

            {!isDesktopLayout && <div>{bookingPanel}</div>}

            <div className="min-w-0">
              {isService ? (
                <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <div className="h-full [&>div]:h-full">{handoverCard}</div>
                  <div className="h-full md:col-span-1 xl:col-span-2 [&>div]:h-full">
                    {ownerCard}
                  </div>
                </div>
              ) : (
                <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
                  <div className="h-full [&>div]:h-full">{handoverCard}</div>
                  <div className="h-full [&>div]:h-full">{ownerCard}</div>
                </div>
              )}
            </div>
          </div>

          {isDesktopLayout && (
            <aside className="min-w-0">{bookingPanel}</aside>
          )}
        </section>
      </div>
    </main>
  );
}


function OfferVideoGallery({
  title,
  videos,
}: {
  title: string;
  videos: ItemVideo[];
}) {
  const sortedVideos = useMemo(
    () =>
      [...videos].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    [videos],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, sortedVideos.length - 1));
  }, [sortedVideos.length]);

  const showPrevious = useCallback(() => {
    setActiveIndex((current) =>
      current === 0 ? sortedVideos.length - 1 : current - 1,
    );
  }, [sortedVideos.length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) =>
      current === sortedVideos.length - 1 ? 0 : current + 1,
    );
  }, [sortedVideos.length]);

  if (sortedVideos.length === 0) return null;

  const activeVideo = sortedVideos[activeIndex];
  const hasMultipleVideos = sortedVideos.length > 1;

  return (
    <section className="koluj-card overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-5 md:px-8">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--koluj-green)]">
            Videa
          </p>
          <h2 className="mt-1 text-2xl font-black">Ukázka nabídky</h2>
        </div>

        {hasMultipleVideos && (
          <span className="shrink-0 rounded-full bg-[var(--koluj-bg)] px-3 py-1.5 text-sm font-black text-[var(--koluj-muted)]">
            {activeIndex + 1} / {sortedVideos.length}
          </span>
        )}
      </div>

      <div
        className="relative bg-black"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
          touchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          if (!hasMultipleVideos) return;

          const startX = touchStartX.current;
          const startY = touchStartY.current;
          const endX = event.changedTouches[0]?.clientX;
          const endY = event.changedTouches[0]?.clientY;

          touchStartX.current = null;
          touchStartY.current = null;

          if (startX === null || startY === null || endX == null || endY == null) {
            return;
          }

          const deltaX = endX - startX;
          const deltaY = endY - startY;

          if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY)) {
            return;
          }

          if (deltaX < 0) showNext();
          else showPrevious();
        }}
      >
        <video
          key={activeVideo.id}
          src={activeVideo.video_url}
          poster={activeVideo.thumbnail_url || undefined}
          aria-label={`Video k nabídce ${title}`}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full object-contain"
        />

        {hasMultipleVideos && (
          <>
            <button
              type="button"
              onClick={showPrevious}
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--koluj-ink)] shadow-lg transition hover:bg-white md:left-5"
              aria-label="Předchozí video"
            >
              <ChevronLeft size={26} />
            </button>
            <button
              type="button"
              onClick={showNext}
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--koluj-ink)] shadow-lg transition hover:bg-white md:right-5"
              aria-label="Další video"
            >
              <ChevronRight size={26} />
            </button>
          </>
        )}
      </div>

      {hasMultipleVideos && (
        <div className="flex justify-center gap-2 px-5 py-4">
          {sortedVideos.map((video, index) => (
            <button
              key={video.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2.5 rounded-full transition-all ${
                index === activeIndex
                  ? "w-8 bg-[var(--koluj-green)]"
                  : "w-2.5 bg-[var(--koluj-border)] hover:bg-[var(--koluj-muted)]"
              }`}
              aria-label={`Zobrazit video ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
