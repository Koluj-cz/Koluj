"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PageLoader from "@/app/components/PageLoader";
import BackLink from "@/app/components/BackLink";
import {
  categoryLabels,
  conditionLabels,
  handoverLabels,
  serviceCategoryLabels,
} from "@/lib/constants";
import { formatDate, formatDateTime, translatePriceUnit } from "@/lib/format";

import {
  CalendarDays,
  Check,
  Edit,
  Handshake,
  MapPin,
  ShieldCheck,
  Star,
  Eye,
  Paperclip,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const OffersMap = dynamic(() => import("@/app/components/OffersMap"), {
  ssr: false,
});

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

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateInsideBlock(date: string, block: AvailabilityBlock) {
  return block.date_from <= date && block.date_to >= date;
}

type ItemImage = {
  id: string;
  image_url: string;
  sort_order: number | null;
};

type AvailabilityBlock = {
  id: string;
  date_from: string;
  date_to: string;
  reason: string | null;
};

type ItemDetail = {
  id: string;
  owner_id: string | null;
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
  price_note: string | null;
  deposit: number | null;
  contact_note: string | null;
  handover_options: string[] | null;
  primary_image_url: string | null;
  created_at: string;
  views_count: number | null;
  service_booking_mode?: "scheduled" | "deadline" | string | null;
  service_hours_mode?: "same_every_day" | "weekday_weekend" | string | null;
  weekday_start_time?: string | null;
  weekday_end_time?: string | null;
  weekend_start_time?: string | null;
  weekend_end_time?: string | null;
  availability_status?: "available" | "reserved" | "unavailable";
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    is_verified: boolean | null;
    is_seed_user: boolean | null;
    profile_ratings?:
      | {
          rating_avg: number | null;
          rating_count: number | null;
        }[]
      | null;
  } | null;
};

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.id as string;

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [images, setImages] = useState<ItemImage[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [availabilityBlocks, setAvailabilityBlocks] = useState<
    AvailabilityBlock[]
  >([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [borrowFrom, setBorrowFrom] = useState("");
  const [borrowTo, setBorrowTo] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [borrowNote, setBorrowNote] = useState("");
  const [borrowAttachment, setBorrowAttachment] = useState<File | null>(null);
  const [submittingBorrowRequest, setSubmittingBorrowRequest] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
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
      setAvailabilityBlocks((result.availabilityBlocks || []) as AvailabilityBlock[]);
      setImages(result.images || []);
      setSelectedImage(
        result.item.primary_image_url || result.images?.[0]?.image_url || "",
      );
    } catch (error) {
      console.error("Unexpected item detail error:", error);
      toast.error("Detail nabídky se nepodařilo načíst");
      router.push("/");
    } finally {
      setLoading(false);
    }
  }


  async function handleBorrowClick() {
    if (!item || submittingBorrowRequest) return;

    if (!currentUserId) {
      router.push(`/login?redirectTo=${encodeURIComponent(`/offers/${item.id}`)}`);
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

  const today = todayIsoDate();

  const activeRequestOnlyBlock = useMemo(() => {
    if (!isRequestOnlyService) return null;

    return (
      availabilityBlocks.find((block) => isDateInsideBlock(today, block)) ||
      null
    );
  }, [availabilityBlocks, isRequestOnlyService, today]);

  const nextRequestOnlyBlock = useMemo(() => {
    if (!isRequestOnlyService) return null;

    return activeRequestOnlyBlock || availabilityBlocks[0] || null;
  }, [activeRequestOnlyBlock, availabilityBlocks, isRequestOnlyService]);

  const isRequestOnlyUnavailable = Boolean(activeRequestOnlyBlock);

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

  const mapOffers = useMemo(() => {
    if (!item) return [];

    return [
      {
        id: item.id,
        title: item.title,
        pickup_place: item.pickup_place,
        price_amount: item.price_amount,
        price_unit: item.price_unit,
        pickup_latitude: item.pickup_latitude,
        pickup_longitude: item.pickup_longitude,
      },
    ];
  }, [item]);

  if (loading) {
    return (
      <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
        <PageLoader />
      </main>
    );
  }

  if (!item) return null;

  const ownerName = item.profiles?.full_name || "Uživatel";
  const ownerInitial = ownerName.charAt(0).toUpperCase();
  const isService = item.offer_type === "service";

  const descriptionCard = item.description ? (
    <div className="koluj-card p-6 md:p-8">
      <h2 className="text-2xl font-black">Popis</h2>

      <div
        className="koluj-rich-text mt-3 text-lg leading-relaxed text-[var(--koluj-muted)]"
        dangerouslySetInnerHTML={{
          __html: item.description,
        }}
      />
    </div>
  ) : null;

  const handoverCard = (
    <div className="koluj-card p-6 md:p-8">
      <h2 className="text-2xl font-black">Předání</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InfoLine
          icon={<MapPin size={20} />}
          title={
            item.offer_type === "service"
              ? "Lokalita působení"
              : "Místo předání"
          }
          text={item.pickup_place}
        />

        {item.offer_type !== "service" && (
          <InfoLine
            icon={<Handshake size={20} />}
            title="Možnosti předání"
            text={
              item.handover_options && item.handover_options.length > 0
                ? item.handover_options
                    .map((option) => handoverLabels[option] || option)
                    .join(", ")
                : "Domluvou"
            }
          />
        )}

        {item.contact_note && (
          <InfoLine
            icon={<Check size={20} />}
            title="Poznámka k předání"
            text={item.contact_note}
          />
        )}
      </div>
    </div>
  );

  const ownerCard = (
    <div className="koluj-card p-6 md:p-8">
      <h2 className="text-2xl font-black">Vlastník</h2>

      <Link
        href={`/users/${item.owner_id}`}
        className="mt-5 flex items-center gap-4 hover:opacity-80"
      >
        {item.profiles?.avatar_url ? (
          <Image
            src={item.profiles.avatar_url}
            alt={ownerName}
            width={56}
            height={56}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-xl font-black text-[var(--koluj-green)]">
            {ownerInitial}
          </div>
        )}

        <div>
          <p className="text-xl font-black">{ownerName}</p>

          <p className="font-bold text-[var(--koluj-green)]">
            {ratingText}
            {ratingCountText && (
              <span className="ml-1 text-[var(--koluj-muted)]">
                {ratingCountText}
              </span>
            )}
          </p>
        </div>
      </Link>

      {item.profiles?.is_verified && (
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-4 py-2 text-sm font-bold text-[var(--koluj-green)]">
          <ShieldCheck size={16} />
          Ověřený profil
        </p>
      )}
    </div>
  );

  const mapCard =
    item.pickup_latitude && item.pickup_longitude ? (
      <div className="koluj-card overflow-hidden p-0">
        <div className="relative h-[320px] lg:h-[420px]">
          <OffersMap items={mapOffers} userLocation={null} />
        </div>
      </div>
    ) : null;

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackLink href="/">Domů</BackLink>
          </div>
        </section>

        <section className="mt-6 grid gap-6 md:mt-10 xl:grid-cols-[minmax(0,1fr)_460px] lg:gap-8">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[34px] bg-[var(--koluj-surface)] shadow-[0_18px_55px_rgba(31,31,26,0.12)]">
              <div className="border-b border-[var(--koluj-border)] px-5 py-6 md:px-8 md:py-7">
                <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
                  {item.offer_type === "service"
                    ? serviceCategoryLabels[item.category] || item.category
                    : categoryLabels[item.category] || item.category}
                </p>

                <h1 className="mt-4 max-w-4xl text-4xl font-black leading-none tracking-tight md:text-6xl">
                  {item.title}
                </h1>

                <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold text-[var(--koluj-muted)] md:text-base">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-3 py-1.5">
                    <Star size={16} className="text-[var(--koluj-green)]" />
                    {ratingText}
                    {ratingCountText && <span>{ratingCountText}</span>}
                  </span>

                  {item.condition && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-3 py-1.5">
                      <ShieldCheck
                        size={16}
                        className="text-[var(--koluj-green)]"
                      />
                      {conditionLabels[item.condition] || item.condition}
                    </span>
                  )}
                </div>
              </div>

              {selectedImage ? (
                <div className="relative flex h-[320px] items-center justify-center overflow-hidden bg-[var(--koluj-bg)] sm:h-[380px] md:h-[560px]">
                  <Image
                    src={selectedImage}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(max-width: 1280px) 100vw, 70vw"
                    className="scale-110 object-cover opacity-35 blur-2xl"
                  />

                  <div className="absolute inset-0 bg-white/20" />

                  <Image
                    src={selectedImage}
                    alt={item.title}
                    fill
                    sizes="(max-width: 1280px) 100vw, 70vw"
                    className="relative z-10 object-contain p-5 md:p-8"
                    priority
                  />
                </div>
              ) : item.offer_type !== "service" ? (
                <div className="relative flex h-[320px] items-center justify-center overflow-hidden bg-[var(--koluj-bg)] sm:h-[380px] md:h-[560px]">
                  <div className="flex h-full items-center justify-center text-[var(--koluj-muted)]">
                    Bez fotky
                  </div>
                </div>
              ) : null}

              {images.length > 1 && (
                <div className="grid grid-cols-3 gap-3 border-t border-[var(--koluj-border)] bg-[var(--koluj-surface)] p-4 sm:grid-cols-4 lg:flex lg:overflow-x-auto">
                  {images.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedImage(image.image_url)}
                      className={`aspect-[6/5] min-w-0 overflow-hidden rounded-2xl border-2 lg:h-20 lg:w-24 lg:shrink-0 ${
                        selectedImage === image.image_url
                          ? "border-[var(--koluj-green)]"
                          : "border-transparent opacity-75 hover:opacity-100"
                      }`}
                      aria-label={`Zobrazit fotku ${index + 1}`}
                    >
                      <Image
                        src={image.image_url}
                        alt=""
                        width={144}
                        height={120}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isService ? (
              <>
                <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <div className="h-full [&>div]:h-full">
                    <MetaAndDescriptionCard item={item} />
                  </div>

                  <div className="h-full [&>div]:h-full">
                    {handoverCard}
                  </div>

                  <div className="h-full md:col-span-2 xl:col-span-1 [&>div]:h-full">
                    {ownerCard}
                  </div>
                </div>

                {mapCard && (
                  <div className="hidden xl:block">
                    {mapCard}
                  </div>
                )}
              </>
            ) : (
              <div className="hidden space-y-6 xl:block">
                <MetaAndDescriptionCard item={item} />
                {handoverCard}
                {mapCard}
              </div>
            )}
          </div>

          <aside className="min-w-0 space-y-5 md:space-y-6">
            <div className="koluj-card p-5 md:p-8">
              <div className="rounded-3xl bg-[var(--koluj-bg)] p-5">
                <p className="text-sm font-bold text-[var(--koluj-muted)]">
                  Cena
                </p>

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

                {!isService &&
                  item.deposit !== null &&
                  item.deposit !== undefined && (
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
                  isOwner={Boolean(isOwner)}
                  selectedRange={
                    (!isService || isRequestOnlyService) &&
                    borrowFrom &&
                    borrowTo
                      ? {
                          dateFrom: borrowFrom,
                          dateTo: borrowTo,
                        }
                      : null
                  }
                  selectedSlot={
                    isTimedService && startsAt && endsAt
                      ? {
                          startsAt,
                          endsAt,
                        }
                      : null
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
                          {formatDateTime(startsAt)}{" "}
                          <span className="mx-2">→</span>{" "}
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
                      Zpráva pro vlastníka{" "}
                      <span className="font-normal">(volitelné)</span>
                      <textarea
                        value={borrowNote}
                        maxLength={500}
                        disabled={submittingBorrowRequest}
                        onChange={(e) => setBorrowNote(e.target.value)}
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
                      : isTimedService &&
                            startsAt &&
                            endsAt &&
                            startsAt !== endsAt
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
                <ShieldCheck
                  size={20}
                  className="shrink-0 text-[var(--koluj-green)]"
                />
                {isService
                  ? "Po odeslání poptávky se domluvte s poskytovatelem na průběhu služby, ceně a všech detailech."
                  : "Domluv se s vlastníkem na detailech. Platbu a předání věci řešte bezpečně a férově."}
              </div>
            </div>

            {!isService && (
              <div className="hidden xl:block">{ownerCard}</div>
            )}
          </aside>
        </section>

        {!isService && (
          <div className="mt-6 space-y-6 xl:hidden">
            <MetaAndDescriptionCard item={item} />
            {handoverCard}
            {ownerCard}
          </div>
        )}

        {mapCard && (
          <section className="mt-6 xl:hidden">
            {mapCard}
          </section>
        )}
      </div>
    </main>
  );
}

function MetaAndDescriptionCard({ item }: { item: ItemDetail }) {
  return (
    <div className="koluj-card p-6 md:p-8">
      <div className="flex flex-wrap gap-3 text-sm font-bold text-[var(--koluj-muted)]">
        <span className="flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-4 py-2">
          <CalendarDays size={16} />
          Přidáno {formatDate(item.created_at)}
        </span>

        <span className="flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-4 py-2">
          <Eye size={16} />
          {item.views_count || 0} zobrazení
        </span>
      </div>

      {item.description && (
        <div className="mt-6">
          <h2 className="text-2xl font-black">Popis</h2>

          <div
            className="koluj-rich-text mt-3 text-lg leading-relaxed text-[var(--koluj-muted)]"
            dangerouslySetInnerHTML={{
              __html: item.description,
            }}
          />
        </div>
      )}
    </div>
  );
}

function InfoLine({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-[var(--koluj-border)] p-5">
      <div className="flex items-center gap-3 text-[var(--koluj-green)]">
        {icon}
        <p className="font-black">{title}</p>
      </div>

      <p className="mt-3 text-[var(--koluj-muted)]">{text}</p>
    </div>
  );
}
