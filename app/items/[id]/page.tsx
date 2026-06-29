"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PageLoader from "@/app/components/PageLoader";
import BackLink from "@/app/components/BackLink";
import {
  categoryLabels,
  conditionLabels,
  handoverLabels,
  itemStatusClasses,
  itemStatusLabels,
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


const ItemsMap = dynamic(() => import("@/app/components/ItemsMap"), {
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
  status: string | null;
  availability_type: string | null;
  available_from: string | null;
  available_to: string | null;
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
  const itemId = params.id as string;

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [images, setImages] = useState<ItemImage[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [borrowFrom, setBorrowFrom] = useState("");
  const [borrowTo, setBorrowTo] = useState("");
  const [borrowNote, setBorrowNote] = useState("");
  const [isWatchingAvailability, setIsWatchingAvailability] = useState(false);
  const [savingAvailabilityWatch, setSavingAvailabilityWatch] = useState(false);
  const [submittingBorrowRequest, setSubmittingBorrowRequest] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id || null);

    const { data, error } = await supabase
      .from("items")
      .select(
        `
        *,
        profiles:profiles!items_owner_id_fkey (
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
      .eq("id", itemId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      toast.error("Věc se nepodařilo načíst");
      router.push("/items");
      return;
    }

    await supabase.rpc("increment_item_views", {
      item_id_input: itemId,
    });

    const { data: imageData } = await supabase
      .from("item_images")
      .select("*")
      .eq("item_id", itemId)
      .order("sort_order", { ascending: true });

    setImages(imageData || []);
    setSelectedImage(
      data.primary_image_url || imageData?.[0]?.image_url || ""
    );

    if (user?.id) {
      const { data: watcherData } = await supabase
        .from("item_availability_watchers")
        .select("id")
        .eq("item_id", itemId)
        .eq("user_id", user.id)
        .is("notified_at", null)
        .maybeSingle();

      setIsWatchingAvailability(Boolean(watcherData));
    }

    setLoading(false);
  }

  async function handleBorrowClick() {
    if (!item || submittingBorrowRequest) return;

    if (!currentUserId) {
      router.push("/login");
      return;
    }

    setSubmittingBorrowRequest(true);

    const response = await fetch("/api/loans/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        itemId: item.id,
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
        "Nejdřív dokonči profil, aby bylo jasné, s kým a kde se věc předává."
      ) {
        router.push("/profile");
      }

      return;
    }

    setItem({
      ...item,
      status: "reserved",
    });

    toast.success("Žádost o půjčení byla odeslána");
    router.push(`/dashboard/loans/${result.loanId}`);
  }

  async function handleWatchAvailabilityClick() {
    if (!item) return;

    if (!currentUserId) {
      router.push("/login");
      return;
    }

    if (currentUserId === item.owner_id) {
      toast.error("Vlastní věc si nemusíš hlídat.");
      return;
    }

    if (item.status === "available") {
      toast.success("Věc je právě dostupná.");
      return;
    }

    if (item.profiles?.is_seed_user) {
      toast(
        "💚 Tato nabídka je ukázková. Přidej svou první věc a pomoz rozšířit Koluj ve svém okolí."
      );
      return;
    }

    setSavingAvailabilityWatch(true);

    const { error } = await supabase
      .from("item_availability_watchers")
      .upsert(
        {
          item_id: item.id,
          user_id: currentUserId,
          notified_at: null,
        },
        {
          onConflict: "item_id,user_id",
        }
      );

    setSavingAvailabilityWatch(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setIsWatchingAvailability(true);
    toast.success("Dáme ti vědět, jakmile bude věc znovu volná.");
  }

  const isOwner = item?.owner_id && currentUserId === item.owner_id;

  const rating = item?.profiles?.profile_ratings?.[0];

  const ratingText =
    rating && rating.rating_count
      ? `★ ${Number(rating.rating_avg).toFixed(1)}`
      : "★ Nový";

  const ratingCountText =
    rating && rating.rating_count ? `(${rating.rating_count})` : "";

  const status = item?.status || "available";
  const statusLabel = itemStatusLabels[status] || status;
  const statusClass = itemStatusClasses[status] || itemStatusClasses.available;
  const todayIso = new Date().toISOString().split("T")[0];
  const isSingleDateRequest = item?.price_unit === "piece";

  const mapItems = useMemo(() => {
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

  return (
    <main className="min-h-screen">
      <div className="koluj-shell-wide">
        <header className="koluj-page-header">
          <BackLink href="/items">Zpět na věci</BackLink>

        {currentUserId ? (
          isOwner ? (
            <Link
              href={`/items/${item.id}/edit`}
              className="koluj-button flex items-center gap-2 px-6 py-3"
            >
              <Edit size={18} />
              Upravit věc
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

        <section className="mt-6 grid gap-8 md:mt-10 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[34px] bg-[var(--koluj-surface)] shadow-[0_18px_55px_rgba(31,31,26,0.12)]">
              <div className="border-b border-[var(--koluj-border)] px-5 py-6 md:px-8 md:py-7">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
                      {categoryLabels[item.category] || item.category}
                    </p>

                    <span className={`koluj-status-badge shrink-0 ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <h1 className="mt-4 max-w-4xl text-4xl font-black leading-none tracking-tight md:text-6xl">
                    {item.title}
                  </h1>

                  {item.condition && (
                    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[var(--koluj-muted)] md:text-base">
                      <span className="flex items-center gap-2">
                        <Star size={18} />
                        {conditionLabels[item.condition] || item.condition}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden bg-[var(--koluj-bg)] md:min-h-[560px]">
                {selectedImage ? (
                  <>
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
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--koluj-muted)]">
                    Bez fotky
                  </div>
                )}
              </div>

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

            <div className="koluj-card p-6 md:p-8">
              <h2 className="text-2xl font-black">Předání</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InfoLine
                  icon={<MapPin size={20} />}
                  title="Místo předání"
                  text={item.pickup_place}
                />

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

                {item.contact_note && (
                  <InfoLine
                    icon={<Check size={20} />}
                    title="Poznámka k předání"
                    text={item.contact_note}
                  />
                )}

                <InfoLine
                  icon={<CalendarDays size={20} />}
                  title="Dostupnost"
                  text={
                    item.availability_type === "period"
                      ? `${formatDate(item.available_from)} – ${formatDate(
                          item.available_to
                        )}`
                      : "Dlouhodobě k dispozici"
                  }
                />
              </div>
            </div>
          </div>

          <aside className="min-w-0 space-y-5 md:space-y-6">
            <div className="koluj-card p-5 md:p-8">
              <div className="rounded-3xl bg-[var(--koluj-bg)] p-5">
                <p className="text-sm font-bold text-[var(--koluj-muted)]">
                  Cena
                </p>

                <p className="mt-2 text-4xl font-black">
                  {item.price_amount
                    ? `${item.price_amount} Kč`
                    : "Dohodou"}
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

              {isOwner && (
                <Link
                  href={`/items/${item.id}/edit`}
                  className="koluj-button mt-6 flex w-full items-center justify-center gap-2 px-6 py-4"
                >
                  <Edit size={18} />
                  Upravit vlastní věc
                </Link>
              )}

              {!isOwner && status === "available" && (
                <>
                  <div className="mt-6 grid gap-3">
                    <div
                      className={`grid min-w-0 gap-3 ${
                        isSingleDateRequest ? "" : "sm:grid-cols-2"
                      }`}
                    >
                      <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
                        {isSingleDateRequest ? "Datum převzetí" : "Od kdy"}
                        <input
                          type="date"
                          value={borrowFrom}
                          min={todayIso}
                          disabled={submittingBorrowRequest}
                          onChange={(e) => {
                            const value = e.target.value;

                            setBorrowFrom(value);

                            if (!borrowTo || borrowTo < value || isSingleDateRequest) {
                              setBorrowTo(value);
                            }
                          }}
                          className="koluj-input w-full min-w-0 max-w-full appearance-none"
                        />
                      </label>

                      {!isSingleDateRequest && (
                        <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
                          Do kdy
                          <input
                            type="date"
                            value={borrowTo}
                            min={borrowFrom || todayIso}
                            disabled={submittingBorrowRequest}
                            onChange={(e) => {
                              const value = e.target.value;

                              if (borrowFrom && value < borrowFrom) {
                                setBorrowTo(borrowFrom);
                                return;
                              }

                              setBorrowTo(value);
                            }}
                            className="koluj-input w-full min-w-0 max-w-full appearance-none"
                          />
                        </label>
                      )}
                    </div>

                    <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
                      Zpráva pro vlastníka
                      <textarea
                        value={borrowNote}
                        maxLength={500}
                        disabled={submittingBorrowRequest}
                        onChange={(e) => setBorrowNote(e.target.value)}
                        placeholder="Dobrý den, potřeboval bych věc půjčit od pátku do neděle. Hodilo by se Vám předání večer?"
                        className="koluj-input min-h-[100px] disabled:opacity-70"
                      />
                    </label>

                    <p className="text-right text-xs text-[var(--koluj-muted)]">
                      {borrowNote.length}/500
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleBorrowClick}
                    disabled={submittingBorrowRequest}
                    className="koluj-button mt-6 w-full px-6 py-4 disabled:cursor-wait disabled:opacity-70"
                  >
                    {submittingBorrowRequest ? "Odesílám žádost..." : "Půjčit si"}
                  </button>
                </>
              )}

              {!isOwner && status !== "available" && (
                <div className="mt-6 rounded-3xl bg-[var(--koluj-bg)] p-5">
                  <p className="font-black">Věc je momentálně nedostupná</p>

                  <p className="mt-2 text-sm text-[var(--koluj-muted)]">
                    Jakmile bude znovu volná, můžeme ti poslat upozornění.
                  </p>

                  <button
                    type="button"
                    onClick={handleWatchAvailabilityClick}
                    disabled={isWatchingAvailability || savingAvailabilityWatch}
                    className="koluj-button mt-4 w-full px-6 py-4 disabled:cursor-default disabled:opacity-70"
                  >
                    {savingAvailabilityWatch
                      ? "Ukládám..."
                      : isWatchingAvailability
                      ? "✓ Hlídáš dostupnost"
                      : "🔔 Hlídat dostupnost"}
                  </button>

                  {isWatchingAvailability && (
                    <p className="mt-3 text-center text-sm font-bold text-[var(--koluj-green)]">
                      Dáme ti vědět, jakmile bude věc opět volná.
                    </p>
                  )}
                </div>
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

            <div className="koluj-card p-8">
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
          </aside>
            {item.pickup_latitude && item.pickup_longitude && (
              <div className="koluj-card overflow-hidden p-0">
                <div className="relative h-[420px]">
                  <ItemsMap items={mapItems} userLocation={null} />
                </div>
              </div>
            )}
        </section>
      </div>
    </main>
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