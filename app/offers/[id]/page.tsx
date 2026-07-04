"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PageLoader from "@/app/components/PageLoader";
import BackLink from "@/app/components/BackLink";
import AvailabilityCalendar from "@/app/components/AvailabilityCalendar";
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
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

const OffersMap = dynamic(() => import("@/app/components/OffersMap"), {
  ssr: false,
});

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
  const [submittingBorrowRequest, setSubmittingBorrowRequest] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id || null);

      const { data, error } = await supabase
        .from("offers")
        .select(
          `
          *,
          profiles:profiles!offers_owner_id_fkey (
            full_name,
            avatar_url,
            is_verified,
            is_seed_user,
            profile_ratings (
              rating_avg,
              rating_count
            )
          )
          `,
        )
        .eq("id", offerId)
        .is("deleted_at", null)
        .single();

      if (error || !data) {
        console.error("Item load error:", error);
        toast.error("Nabídku se nepodařilo načíst");
        router.push("/offers");
        return;
      }

      await supabase.rpc("increment_offer_views", {
        offer_id_input: offerId,
      });

      setItem({
        ...(data as ItemDetail),
        views_count: Number(data.views_count || 0) + 1,
      });

      const { data: imageData, error: imageError } = await supabase
        .from("offer_images")
        .select("*")
        .eq("offer_id", offerId)
        .order("sort_order", { ascending: true });

      if (imageError) {
        console.error("Item images load error:", imageError);
      }

      const today = todayIsoDate();

      const { data: blocksData, error: blocksError } = await supabase
        .from("offer_availability_blocks")
        .select("id, date_from, date_to, reason")
        .eq("offer_id", offerId)
        .gte("date_to", today)
        .order("date_from", { ascending: true });

      if (blocksError) {
        console.error("Availability blocks load error:", blocksError);
      }

      setAvailabilityBlocks((blocksData || []) as AvailabilityBlock[]);
      setImages(imageData || []);
      setSelectedImage(
        data.primary_image_url || imageData?.[0]?.image_url || "",
      );
    } catch (error) {
      console.error("Unexpected item detail error:", error);
      toast.error("Detail nabídky se nepodařilo načíst");
      router.push("/offers");
    } finally {
      setLoading(false);
    }
  }

  async function handleBorrowClick() {
    if (!item || submittingBorrowRequest) return;

    if (!currentUserId) {
      router.push("/login");
      return;
    }

    if (
      item.offer_type === "service" &&
      item.price_unit === "piece" &&
      availabilityBlocks.some((block) =>
        isDateInsideBlock(todayIsoDate(), block),
      )
    ) {
      toast.error("Poskytovatel momentálně nepřijímá nové poptávky.");
      return;
    }

    setSubmittingBorrowRequest(true);

    const response = await fetch("/api/bookings/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offerId: item.id,
        dateFrom: item.offer_type === "service" ? null : borrowFrom,
        dateTo: item.offer_type === "service" ? null : borrowTo,
        startsAt:
          item.offer_type === "service" && item.price_unit === "hour"
            ? startsAt
            : null,
        endsAt:
          item.offer_type === "service" && item.price_unit === "hour"
            ? endsAt
            : null,
        note: borrowNote,
      }),
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
    item?.offer_type === "service" && item?.price_unit === "hour";
  const isRequestOnlyService =
    item?.offer_type === "service" && item?.price_unit === "piece";

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


  const handoverCard = (
    <section className="koluj-card p-5 md:p-7">
      <h2 className="text-2xl font-black">Předání</h2>

      <div className="mt-5 grid gap-4">
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
    </section>
  );

  const ownerCard = (
    <section className="koluj-card p-5 md:p-6">
      <h2 className="text-xl font-black">Vlastník</h2>

      <Link
        href={`/users/${item.owner_id}`}
        className="mt-5 flex items-center gap-4 hover:opacity-80"
      >
        {item.profiles?.avatar_url ? (
          <img
            src={item.profiles.avatar_url}
            alt={ownerName}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-lg font-black text-[var(--koluj-green)]">
            {ownerInitial}
          </div>
        )}

        <div className="min-w-0">
          <p className="truncate text-lg font-black">{ownerName}</p>

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
    </section>
  );

  const mapCard =
    item.pickup_latitude && item.pickup_longitude ? (
      <section className="koluj-card overflow-hidden p-0">
        <div className="border-b border-[var(--koluj-border)] px-5 py-4 md:px-6">
          <h2 className="text-xl font-black">Lokalita</h2>
        </div>

        <div className="relative h-[280px] md:h-[320px]">
          <OffersMap items={mapOffers} userLocation={null} />
        </div>
      </section>
    ) : null;

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[var(--koluj-border)] bg-white px-5 py-5 md:px-8">
          <BackLink href="/">Domů</BackLink>

          {currentUserId ? (
            isOwner ? (
              <Link
                href={`/offers/${item.id}/edit`}
                className="koluj-header-button"
              >
                <Edit size={17} />
                Upravit nabídku
              </Link>
            ) : (
              <Link href="/dashboard" className="koluj-header-button">
                Můj prostor
              </Link>
            )
          ) : (
            <Link href="/login" className="koluj-header-button">
              Přihlásit se
            </Link>
          )}
        </header>

        <section className="mb-5 rounded-[30px] border border-[var(--koluj-border)] bg-white p-5 md:p-7">
          <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
            {item.offer_type === "service"
              ? serviceCategoryLabels[item.category] || item.category
              : categoryLabels[item.category] || item.category}
          </p>

          <h1 className="mt-3 text-4xl font-black leading-none tracking-[-0.06em] text-[var(--koluj-ink)] md:text-6xl">
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
                <ShieldCheck size={16} className="text-[var(--koluj-green)]" />
                {conditionLabels[item.condition] || item.condition}
              </span>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
          <div className="space-y-6">
            {selectedImage ? (
              <section className="koluj-card overflow-hidden p-0">
                <div className="relative flex h-[300px] items-center justify-center overflow-hidden bg-[var(--koluj-bg)] md:h-[430px]">
                  <img
                    src={selectedImage}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
                  />

                  <div className="absolute inset-0 bg-white/35" />

                  <img
                    src={selectedImage}
                    alt={item.title}
                    className="relative z-10 h-full max-h-[280px] w-full object-contain p-5 md:max-h-[400px] md:p-8"
                  />
                </div>

                {images.length > 1 && (
                  <div className="grid grid-cols-3 gap-3 border-t border-[var(--koluj-border)] bg-white p-4 sm:grid-cols-4 lg:grid-cols-6">
                    {images.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setSelectedImage(image.image_url)}
                        className={`h-20 overflow-hidden rounded-2xl border-2 ${
                          selectedImage === image.image_url
                            ? "border-[var(--koluj-green)]"
                            : "border-[var(--koluj-border)] opacity-75 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={image.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : item.offer_type !== "service" ? (
              <section className="koluj-card flex h-[300px] items-center justify-center text-[var(--koluj-muted)] md:h-[430px]">
                Bez fotky
              </section>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <MetaAndDescriptionCard item={item} />
              {handoverCard}
            </div>
          </div>

          <aside className="flex min-w-0 flex-col gap-5 md:gap-6 xl:sticky xl:top-8 xl:self-start">
            <section className="koluj-card p-5 md:p-6">
              <p className="text-sm font-bold text-[var(--koluj-muted)]">
                Cena
              </p>

              <p className="mt-2 text-4xl font-black tracking-[-0.04em] text-[var(--koluj-ink)]">
                {item.price_amount ? `${item.price_amount} Kč` : "Dohodou"}
              </p>

              {item.price_unit && (
                <p className="mt-1 font-black text-[var(--koluj-green)]">
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

              {item.price_note && (
                <p className="mt-4 rounded-2xl border border-[var(--koluj-border)] bg-white px-4 py-3 text-sm text-[var(--koluj-muted)]">
                  {item.price_note}
                </p>
              )}
            </section>

            <section className="koluj-card p-5 md:p-6">
              <h2 className="mb-5 text-xl font-black">Dostupnost</h2>

              {(!isRequestOnlyService || isOwner) && (
                <AvailabilityCalendar
                  offerId={item.id}
                  offerType={isRequestOnlyService ? "item" : item.offer_type}
                  isOwner={Boolean(isOwner)}
                  selectedRange={
                    (!isService || (isRequestOnlyService && Boolean(isOwner))) &&
                    borrowFrom &&
                    borrowTo
                      ? { dateFrom: borrowFrom, dateTo: borrowTo }
                      : null
                  }
                  selectedSlot={
                    isTimedService && startsAt && endsAt
                      ? { startsAt, endsAt }
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
              )}

              {isRequestOnlyService && !isOwner && (
                <div className="rounded-3xl bg-[var(--koluj-bg)] p-5">
                  {isRequestOnlyUnavailable && activeRequestOnlyBlock ? (
                    <div className="space-y-2">
                      <p className="font-bold text-red-700">
                        Poskytovatel momentálně nepřijímá nové poptávky.
                      </p>
                      <p className="text-sm font-bold text-[var(--koluj-muted)]">
                        Nedostupné:{" "}
                        {formatDate(activeRequestOnlyBlock.date_from)} –{" "}
                        {formatDate(activeRequestOnlyBlock.date_to)}
                      </p>
                      {activeRequestOnlyBlock.reason && (
                        <p className="text-sm text-[var(--koluj-muted)]">
                          {activeRequestOnlyBlock.reason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[var(--koluj-muted)]">
                        Termín služby domluvíte přímo s poskytovatelem po
                        odeslání poptávky.
                      </p>
                      {nextRequestOnlyBlock && (
                        <p className="text-sm font-bold text-[var(--koluj-muted)]">
                          Plánovaná nedostupnost:{" "}
                          {formatDate(nextRequestOnlyBlock.date_from)} –{" "}
                          {formatDate(nextRequestOnlyBlock.date_to)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 rounded-3xl bg-[var(--koluj-bg)] p-5">
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
                ) : (!isService || (isRequestOnlyService && Boolean(isOwner))) &&
                  borrowFrom &&
                  borrowTo ? (
                  <p className="mt-3 text-lg font-black">
                    {formatDate(borrowFrom)} <span className="mx-2">→</span>{" "}
                    {formatDate(borrowTo)}
                  </p>
                ) : (
                  <p className="mt-3 text-[var(--koluj-muted)]">
                    {isRequestOnlyService && !isOwner
                      ? "Termín služby domluvíte ve zprávách po odeslání poptávky."
                      : isService && !isRequestOnlyService
                        ? "Zatím není vybraný žádný čas."
                        : "Zatím není vybraný žádný termín."}
                  </p>
                )}

                {((isTimedService && startsAt && endsAt) ||
                  ((!isService || (isRequestOnlyService && Boolean(isOwner))) && borrowFrom && borrowTo)) && (
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
                        className="koluj-input min-h-[110px] disabled:opacity-70"
                      />
                    </label>

                    <p className="text-right text-xs text-[var(--koluj-muted)]">
                      {borrowNote.length}/500
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleBorrowClick}
                    disabled={
                      submittingBorrowRequest ||
                      isRequestOnlyUnavailable ||
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
                      : isRequestOnlyUnavailable
                        ? "Momentálně nedostupné"
                        : isTimedService &&
                            startsAt &&
                            endsAt &&
                            startsAt !== endsAt
                          ? "Objednat službu"
                          : isRequestOnlyService
                            ? "Odeslat poptávku"
                            : !isService && borrowFrom && borrowTo
                              ? "Půjčit si"
                              : isTimedService
                                ? "Vyber čas"
                                : "Vyber termín"}
                  </button>
                </>
              )}

              {isOwner && (
                <Link
                  href={`/offers/${item.id}/edit`}
                  className="koluj-button mt-6 flex w-full items-center justify-center gap-2 px-6 py-4"
                >
                  <Edit size={18} />
                  Upravit vlastní nabídku
                </Link>
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
            </section>

            {ownerCard}

            <div className="order-last">
              {mapCard}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function OfferInfoCard({ item }: { item: ItemDetail }) {
  const isService = item.offer_type === "service";

  return (
    <section className="koluj-card p-5 md:p-7">
      <h2 className="text-2xl font-black">O nabídce</h2>

      <div className="mt-5 grid gap-4">
        <InfoLine
          icon={<Info size={20} />}
          title="Kategorie"
          text={
            isService
              ? serviceCategoryLabels[item.category] || item.category
              : categoryLabels[item.category] || item.category
          }
        />

        {item.condition && (
          <InfoLine
            icon={<ShieldCheck size={20} />}
            title="Stav"
            text={conditionLabels[item.condition] || item.condition}
          />
        )}

        <InfoLine
          icon={<CalendarDays size={20} />}
          title="Přidáno"
          text={formatDate(item.created_at)}
        />

        <InfoLine
          icon={<Eye size={20} />}
          title="Zobrazení"
          text={`${item.views_count || 0}`}
        />
      </div>
    </section>
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
