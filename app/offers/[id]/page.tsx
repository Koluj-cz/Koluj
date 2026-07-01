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
} from "@/lib/constants";
import { formatDate, translatePriceUnit } from "@/lib/format";

import {
  CalendarDays,
  Check,
  Edit,
  Handshake,
  MapPin,
  ShieldCheck,
  Star,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

const OffersMap = dynamic(() => import("@/app/components/OffersMap"), {
  ssr: false,
});

type ItemImage = {
  id: string;
  image_url: string;
  sort_order: number | null;
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
    profile_ratings?: {
      rating_avg: number | null;
      rating_count: number | null;
    }[] | null;
  } | null;
};

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.id as string;

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [images, setImages] = useState<ItemImage[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [borrowFrom, setBorrowFrom] = useState("");
  const [borrowTo, setBorrowTo] = useState("");
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
          `
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

      setImages(imageData || []);
      setSelectedImage(
        data.primary_image_url || imageData?.[0]?.image_url || ""
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

    setSubmittingBorrowRequest(true);

    const response = await fetch("/api/bookings/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offerId: item.id,
        dateFrom: borrowFrom,
        dateTo: borrowTo,
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
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    );

    return diff >= 0 ? diff + 1 : null;
  }, [borrowFrom, borrowTo]);

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
      <main className="min-h-screen">
        <PageLoader />
      </main>
    );
  }

  if (!item) return null;

  const ownerName = item.profiles?.full_name || "Uživatel";
  const ownerInitial = ownerName.charAt(0).toUpperCase();

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
          title={item.offer_type === "service" ? "Lokalita působení" : "Místo předání"}
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
        className="mt-5 flex items-center gap-4 transition hover:opacity-80"
      >
        {item.profiles?.avatar_url ? (
          <img
            src={item.profiles.avatar_url}
            alt={ownerName}
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

  const mapCard = item.pickup_latitude && item.pickup_longitude ? (
    <div className="koluj-card overflow-hidden p-0">
      <div className="relative h-[320px] lg:h-[420px]">
        <OffersMap items={mapOffers} userLocation={null} />
      </div>
    </div>
  ) : null;

  return (
    <main className="min-h-screen">
      <div className="koluj-shell-wide">
        <header className="koluj-page-header">
          <BackLink href="/offers">Zpět na nabídky</BackLink>

          {currentUserId ? (
            isOwner ? (
              <Link
                href={`/offers/${item.id}/edit`}
                className="koluj-button flex items-center gap-2 px-6 py-3"
              >
                <Edit size={18} />
                Upravit nabídku
              </Link>
            ) : (
              <Link href="/dashboard" className="koluj-button px-6 py-3">
                Můj prostor
              </Link>
            )
          ) : (
            <Link href="/login" className="koluj-button px-6 py-3">
              Přihlásit se
            </Link>
          )}
        </header>

        <section className="mt-6 grid gap-6 md:mt-10 lg:grid-cols-[1fr_420px] lg:gap-8">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[34px] bg-[var(--koluj-surface)] shadow-[0_18px_55px_rgba(31,31,26,0.12)]">
              <div className="border-b border-[var(--koluj-border)] px-5 py-6 md:px-8 md:py-7">
                <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
                  {categoryLabels[item.category] || item.category}
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
                      <ShieldCheck size={16} className="text-[var(--koluj-green)]" />
                      {conditionLabels[item.condition] || item.condition}
                    </span>
                  )}
                </div>
              </div>

              {selectedImage ? (
                <div className="relative flex h-[360px] items-center justify-center overflow-hidden bg-[var(--koluj-bg)] md:h-[560px]">
                  <img
                    src={selectedImage}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"
                  />

                  <div className="absolute inset-0 bg-white/20" />

                  <img
                    src={selectedImage}
                    alt={item.title}
                    className="relative z-10 h-full max-h-[360px] w-full object-contain p-5 md:max-h-[560px] md:p-8"
                  />
                </div>
              ) : item.offer_type !== "service" ? (
                <div className="relative flex h-[360px] items-center justify-center overflow-hidden bg-[var(--koluj-bg)] md:h-[560px]">
                  <div className="flex h-full items-center justify-center text-[var(--koluj-muted)]">
                    Bez fotky
                  </div>
                </div>
              ) : null}

              {images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto border-t border-[var(--koluj-border)] bg-[var(--koluj-surface)] p-4">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedImage(image.image_url)}
                      className={`h-20 w-24 shrink-0 overflow-hidden rounded-2xl border-2 transition ${
                        selectedImage === image.image_url
                          ? "border-[var(--koluj-green)]"
                          : "border-transparent opacity-75 hover:opacity-100"
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
            </div>

            <div className="hidden space-y-6 lg:block">
              <MetaAndDescriptionCard item={item} />
              {handoverCard}
              {mapCard}
            </div>
          </div>

          <aside className="min-w-0 space-y-5 md:space-y-6">
            <div className="koluj-card p-5 md:p-8">
              <div className="rounded-3xl bg-[var(--koluj-bg)] p-5">
                <p className="text-sm font-bold text-[var(--koluj-muted)]">
                  Cena
                </p>

                <p className="mt-2 text-4xl font-black">
                  {item.price_amount ? `${item.price_amount} Kč` : "Dohodou"}
                </p>

                {item.price_unit && (
                  <p className="mt-1 font-bold text-[var(--koluj-green)]">
                    za {translatePriceUnit(item.price_unit)}
                  </p>
                )}

                {item.deposit !== null && item.deposit !== undefined && (
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
                  isOwner={Boolean(isOwner)}
                  selectedRange={
                    borrowFrom && borrowTo
                      ? { dateFrom: borrowFrom, dateTo: borrowTo }
                      : null
                  }
                  onRangeChange={(range) => {
                    setBorrowFrom(range?.dateFrom || "");
                    setBorrowTo(range?.dateTo || "");
                  }}
                />
              </div>

              <div className="mt-5 rounded-3xl bg-[var(--koluj-bg)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black">Vybraný termín</p>

                    {borrowFrom && borrowTo ? (
                      <p className="mt-3 text-lg font-black">
                        {formatDate(borrowFrom)} <span className="mx-2">→</span>{" "}
                        {formatDate(borrowTo)}
                      </p>
                    ) : (
                      <p className="mt-3 text-[var(--koluj-muted)]">
                        Zatím není vybraný žádný termín.
                      </p>
                    )}
                  </div>

                  {selectedDays && (
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black text-[var(--koluj-green)]">
                      {selectedDays} {selectedDays === 1 ? "den" : "dní"}
                    </span>
                  )}
                </div>

                {borrowFrom && borrowTo && (
                  <button
                    type="button"
                    onClick={() => {
                      setBorrowFrom("");
                      setBorrowTo("");
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
                      Zpráva pro vlastníka <span className="font-normal">(volitelné)</span>
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
                  </div>

                  <button
                    type="button"
                    onClick={handleBorrowClick}
                    disabled={submittingBorrowRequest || !borrowFrom || !borrowTo}
                    className="koluj-button mt-6 w-full px-6 py-4 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submittingBorrowRequest
                      ? "Odesílám žádost..."
                      : borrowFrom && borrowTo
                      ? "Půjčit si"
                      : "Vyber termín"}
                  </button>
                </>
              )}

              <div className="mt-6 flex gap-3 rounded-2xl bg-[var(--koluj-bg)] p-4 text-sm font-bold text-[var(--koluj-muted)]">
                <ShieldCheck
                  size={20}
                  className="shrink-0 text-[var(--koluj-green)]"
                />
                Domluv se s vlastníkem před předáním. Platbu a předání řešte
                bezpečně a férově.
              </div>
            </div>

            <div className="hidden lg:block">{ownerCard}</div>
          </aside>
        </section>

        <div className="mt-6 space-y-6 lg:hidden">
          <MetaAndDescriptionCard item={item} />
          {handoverCard}
          {ownerCard}
          {mapCard}
        </div>
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
