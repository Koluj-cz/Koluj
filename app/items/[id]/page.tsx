"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { notifyUser } from "@/lib/notifyUser";
import PageLoader from "@/app/components/PageLoader";
import {
  categoryLabels,
  conditionLabels,
  handoverLabels,
  itemStatusClasses,
  itemStatusLabels,
} from "@/lib/constants";
import { formatDate, translatePriceUnit } from "@/lib/format";

import {
  ArrowLeft,
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
    setItem({
      ...(data as ItemDetail),
      views_count: Number(data.views_count || 0) + 1,
    });
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
    if (!item) return;

    if (!currentUserId) {
      router.push("/login");
      return;
    }

    if (currentUserId === item.owner_id) {
      toast.error("Vlastní věc si nemůžeš půjčit");
      return;
    }

    if (item.status !== "available") {
      toast.error("Tahle věc není momentálně dostupná");
      return;
    }

    if (item.profiles?.is_seed_user) {
      toast(
        "💚 Tato nabídka je ukázková. Přidej svou první věc a pomoz rozšířit Koluj ve svém okolí."
      );
      return;
    }

    if (!borrowFrom || !borrowTo) {
      toast.error("Vyber termín půjčení.");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fromDate = new Date(borrowFrom);
    const toDate = new Date(borrowTo);

    if (fromDate < today) {
      toast.error("Datum půjčení nemůže být v minulosti.");
      return;
    }

    if (toDate < fromDate) {
      toast.error("Datum vrácení nemůže být dřív než datum půjčení.");
      return;
    }

    const { data: borrowerProfile } = await supabase
      .from("profiles")
      .select("id, full_name, city, latitude, longitude")
      .eq("id", currentUserId)
      .maybeSingle();

    const profileComplete = Boolean(
      borrowerProfile?.id &&
        borrowerProfile.full_name &&
        borrowerProfile.city &&
        borrowerProfile.latitude &&
        borrowerProfile.longitude
    );

    if (!profileComplete) {
      toast.error(
        "Nejdřív dokonči profil, aby bylo jasné, s kým a kde se věc předává."
      );
      router.push("/profile");
      return;
    }

    const { data: existingLoans, error: existingLoanError } = await supabase
      .from("loans")
      .select("id")
      .eq("item_id", item.id)
      .eq("borrower_id", currentUserId)
      .in("status", ["requested", "approved", "active"])
      .limit(1);

    if (existingLoanError) {
      toast.error(existingLoanError.message);
      return;
    }

    if (existingLoans && existingLoans.length > 0) {
      toast.error("O tuhle věc už máš aktivní žádost");
      return;
    }

    const { data: createdLoan, error: loanError } = await supabase
      .from("loans")
      .insert({
        item_id: item.id,
        owner_id: item.owner_id,
        borrower_id: currentUserId,
        status: "requested",
        date_from: borrowFrom,
        date_to: borrowTo,
        price_amount: item.price_amount,
        deposit_amount: item.deposit,
        total_price: item.price_amount,
        platform_fee: 0,
        owner_earnings: item.price_amount,
      })
      .select()
      .single();

    if (loanError || !createdLoan) {
      toast.error(loanError?.message || "Žádost se nepodařilo vytvořit");
      return;
    }

    await notifyUser({
      userId: item.owner_id,
      actorId: currentUserId,
      itemId: item.id,
      loanId: createdLoan.id,
      type: "loan_requested",
      title: "Nová žádost o půjčení",
      message: `si chce půjčit: ${item.title}`,
      emailSubject: "Nová žádost o půjčení",
    });

    const { error: messageError } = await supabase
      .from("loan_messages")
      .insert({
        loan_id: createdLoan.id,
        sender_id: currentUserId,
        is_system: true,
        message: `Žádost o půjčení vytvořena.

Věc: ${item.title}
Termín: ${formatDate(borrowFrom)} – ${formatDate(borrowTo)}
Místo předání: ${item.pickup_place}
Cena: ${item.price_amount || 0} Kč
Kauce: ${item.deposit || 0} Kč${
          borrowNote.trim() ? `\n\nPoznámka: ${borrowNote.trim()}` : ""
        }`,
      });

    if (messageError) {
      toast.error(messageError.message);
      return;
    }

    const { error: itemError } = await supabase
      .from("items")
      .update({ status: "reserved" })
      .eq("id", item.id);

    if (itemError) {
      toast.error(itemError.message);
      return;
    }

    setItem({
      ...item,
      status: "reserved",
    });

    toast.success("Žádost o půjčení byla odeslána");
    router.push(`/dashboard/loans/${createdLoan.id}`);
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
          <Link
            href="/items"
            className="flex items-center gap-2 font-bold text-[var(--koluj-green)]"
          >
            <ArrowLeft size={20} />
            Zpět na věci
          </Link>

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

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <div className="koluj-card overflow-hidden p-0">
              <div className="relative h-[360px] bg-[var(--koluj-bg)] md:h-[520px]">
                {selectedImage ? (
                  <img
                    src={selectedImage}
                    alt={item.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--koluj-muted)]">
                    Bez fotky
                  </div>
                )}

                <span
                  className={`koluj-status-badge absolute right-5 top-5 ${statusClass}`}
                >
                  {statusLabel}
                </span>

                {item.price_amount && item.price_unit && (
                  <div className="absolute bottom-5 left-5 rounded-2xl bg-[var(--koluj-green)] px-5 py-3 text-lg font-black text-white shadow-sm">
                    {item.price_amount} Kč /{" "}
                    {translatePriceUnit(item.price_unit)}
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 md:flex md:overflow-x-auto">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedImage(image.image_url)}
                      className={`h-24 w-full overflow-hidden rounded-2xl border md:w-32 md:shrink-0 ${
                        selectedImage === image.image_url
                          ? "border-[var(--koluj-green)]"
                          : "border-[var(--koluj-border)]"
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

            <div className="koluj-card p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-widest text-[var(--koluj-green)]">
                    {categoryLabels[item.category] || item.category}
                  </p>

                  <h1 className="mt-2 text-5xl font-black tracking-tight">
                    {item.title}
                  </h1>
                </div>

                <span className={`koluj-status-badge ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-[var(--koluj-muted)]">
                <span className="flex items-center gap-2">
                  <MapPin size={18} />
                  {item.pickup_place}
                </span>

                {item.condition && (
                  <span className="flex items-center gap-2">
                    <Star size={18} />
                    {conditionLabels[item.condition] || item.condition}
                  </span>
                )}

                <span className="flex items-center gap-2">
                  <CalendarDays size={18} />
                  Přidáno {formatDate(item.created_at)}
                </span>
                <span className="flex items-center gap-2">
                  <Eye size={18} />
                  {item.views_count || 0} zobrazení
                </span>
              </div>

            {item.description && (
              <div className="mt-8">
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

            <div className="koluj-card p-8">
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

          <aside className="min-w-0 space-y-6">
            <div className="koluj-card p-5 md:p-8 lg:sticky lg:top-8">
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
                        onChange={(e) => setBorrowNote(e.target.value)}
                        placeholder="Dobrý den, potřeboval bych věc půjčit od pátku do neděle. Hodilo by se Vám předání večer?"
                        className="koluj-input min-h-[100px]"
                      />
                    </label>

                    <p className="text-right text-xs text-[var(--koluj-muted)]">
                      {borrowNote.length}/500
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleBorrowClick}
                    className="koluj-button mt-6 w-full px-6 py-4"
                  >
                    Půjčit si
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