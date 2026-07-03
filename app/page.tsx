"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Leaf,
  LocateFixed,
  PackageOpen,
  Search,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import InstallAppButton from "@/app/components/InstallAppButton";
import { getDistanceKm } from "@/lib/location";

const DISPLAYED_ITEMS_COUNT = 8;
type OfferTypeFilter = "all" | "item" | "service";

type CategoryChip = {
  icon: React.ReactNode;
  label: string;
  offerType: OfferTypeFilter;
};

const categoryChips: CategoryChip[] = [
  { icon: <Sparkles size={19} />, label: "Vše", offerType: "all" },
  { icon: <PackageOpen size={19} />, label: "Věci", offerType: "item" },
  { icon: <Briefcase size={19} />, label: "Služby", offerType: "service" },
];

function getOfferType(item: OfferCardOffer) {
  return ((item as OfferCardOffer & { offer_type?: string }).offer_type ||
    "item") as "item" | "service";
}

async function attachTodayAvailability<T extends { id: string }>(items: T[]) {
  if (items.length === 0) {
    return items as (T & { is_reserved_today: boolean })[];
  }

  const today = new Date().toISOString().split("T")[0];
  const offerIds = items.map((item) => item.id);

  const [reservationsResult, blocksResult] = await Promise.all([
    supabase
      .from("offer_reservations")
      .select("offer_id")
      .in("offer_id", offerIds)
      .eq("status", "active")
      .lte("date_from", today)
      .gte("date_to", today),
    supabase
      .from("offer_availability_blocks")
      .select("offer_id")
      .in("offer_id", offerIds)
      .lte("date_from", today)
      .gte("date_to", today),
  ]);

  if (reservationsResult.error) {
    console.error("Reservations availability error:", reservationsResult.error);
  }

  if (blocksResult.error) {
    console.error("Blocks availability error:", blocksResult.error);
  }

  const reservedIds = new Set([
    ...(reservationsResult.data || []).map((row) => row.offer_id),
    ...(blocksResult.data || []).map((row) => row.offer_id),
  ]);

  return items.map((item) => ({
    ...item,
    is_reserved_today: reservedIds.has(item.id),
  }));
}

export default function HomePage() {
  const router = useRouter();
  const [items, setItems] = useState<OfferCardOffer[]>([]);
  const [search, setSearch] = useState("");
  const [selectedOfferType, setSelectedOfferType] =
    useState<OfferTypeFilter>("all");
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadItems();
    loadUser();
  }, []);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsLoggedIn(Boolean(user));
  }

  async function loadItems() {
    const { data, count } = await supabase
      .from("offers")
      .select(
        `
        *,
        profiles:profiles!offers_owner_id_fkey (
          full_name,
          avatar_url,
          is_verified,
          profile_ratings (
            rating_avg,
            rating_count
          )
        )
      `,
        { count: "exact" },
      )
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(40);

    const itemsWithAvailability = await attachTodayAvailability(
      (data || []) as OfferCardOffer[],
    );

    setItems(itemsWithAvailability);
    setTotalItems(count || 0);
  }

  function buildOffersHref() {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (selectedOfferType !== "all") {
      params.set("type", selectedOfferType);
    }

    return `/offers${params.toString() ? `?${params.toString()}` : ""}`;
  }

  function submitSearch() {
    router.push(buildOffersHref());
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Tvoje zařízení nepodporuje zjištění polohy.");
      return;
    }

    toast.loading("Zjišťuji polohu...", { id: "location" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        toast.success("Poloha nalezena", { id: "location" });
      },
      () => toast.error("Nepodařilo se získat polohu.", { id: "location" }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  const filteredItems = useMemo(() => {
    let result = items;

    if (selectedOfferType !== "all") {
      result = result.filter((item) => getOfferType(item) === selectedOfferType);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter((item) =>
        `${item.title} ${item.category} ${item.pickup_place}`
          .toLowerCase()
          .includes(query),
      );
    }

    if (userLocation) {
      result = [...result].sort((a, b) => {
        const aHasLocation = Boolean(a.pickup_latitude && a.pickup_longitude);
        const bHasLocation = Boolean(b.pickup_latitude && b.pickup_longitude);

        if (!aHasLocation && !bHasLocation) return 0;
        if (!aHasLocation) return 1;
        if (!bHasLocation) return -1;

        return (
          getDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            a.pickup_latitude!,
            a.pickup_longitude!,
          ) -
          getDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            b.pickup_latitude!,
            b.pickup_longitude!,
          )
        );
      });
    }

    return result;
  }, [items, search, selectedOfferType, userLocation]);

  const displayedItems = filteredItems.slice(0, DISPLAYED_ITEMS_COUNT);

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_8%,rgba(116,145,54,0.13),transparent_28%),radial-gradient(circle_at_92%_12%,rgba(116,145,54,0.10),transparent_30%),#f7f6ef]">
      <div className="mx-auto w-full max-w-[1760px] px-5 pb-16 pt-5 md:px-8 lg:px-12">
        <header className="flex min-h-14 items-center justify-between gap-4">
          <Link
            href="/"
            className="text-3xl font-black tracking-[-0.06em] text-[var(--koluj-text)] lg:invisible"
          >
            KOLUJ
          </Link>

          <nav className="hidden items-center gap-9 text-sm font-black text-[var(--koluj-muted)] lg:flex">
            <Link href="/offers" className="transition hover:text-[var(--koluj-green)]">
              Nabídky
            </Link>
            <a href="#jak" className="transition hover:text-[var(--koluj-green)]">
              Jak to funguje
            </a>
            <Link href="/offers/new" className="transition hover:text-[var(--koluj-green)]">
              Přidat
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <InstallAppButton />
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="koluj-button px-5 py-3">
              {isLoggedIn ? "Můj prostor" : "Přihlásit"}
            </Link>
          </div>
        </header>

        <section className="relative mx-auto flex min-h-[calc(100vh-7rem)] max-w-[1500px] flex-col justify-center py-10 md:py-14 lg:py-16">
          <div className="max-w-[980px]">
            <p className="koluj-pill w-fit">
              <Leaf size={15} /> Platforma pro sdílení věcí a služeb
            </p>

            <h1 className="mt-7 text-[clamp(4.8rem,12vw,13.5rem)] font-black leading-[0.78] tracking-[-0.105em] text-[var(--koluj-text)]">
              Sdílej.
              <br />
              Půjčuj.
              <br />
              <span className="text-[var(--koluj-green)]">Koluj.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-xl leading-relaxed text-[var(--koluj-muted)] md:text-2xl">
              Půjč si věci. Objednej si služby. Od lidí kolem tebe.
            </p>
          </div>

          <div className="mt-10 max-w-5xl rounded-[34px] border border-white/75 bg-white/82 p-3 shadow-[0_22px_70px_rgba(26,31,22,.12)] backdrop-blur-xl">
            <div className="flex min-h-[66px] items-center gap-3 rounded-full border border-black/[0.08] bg-white px-5">
              <Search size={22} className="shrink-0 text-[var(--koluj-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitSearch();
                }}
                placeholder="Co hledáš? Vrtačku, fotografa, doučování..."
                className="min-w-0 flex-1 bg-transparent py-4 text-base font-bold outline-none placeholder:font-semibold placeholder:text-[var(--koluj-muted)] md:text-lg"
              />
              <button
                type="button"
                onClick={useMyLocation}
                className={`hidden items-center gap-2 rounded-full px-4 py-3 font-black transition sm:flex ${
                  userLocation
                    ? "bg-[var(--koluj-green)] text-white"
                    : "bg-[var(--koluj-green-soft)] text-[var(--koluj-green)] hover:bg-white"
                }`}
              >
                <LocateFixed size={18} /> Okolo mě
              </button>
            </div>

            <button
              type="button"
              onClick={useMyLocation}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 font-black transition sm:hidden ${
                userLocation
                  ? "bg-[var(--koluj-green)] text-white"
                  : "bg-[var(--koluj-green-soft)] text-[var(--koluj-green)]"
              }`}
            >
              <LocateFixed size={18} /> Okolo mě
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {categoryChips.map((chip) => {
              const active = selectedOfferType === chip.offerType;

              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setSelectedOfferType(chip.offerType)}
                  className={`inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border px-6 py-3 font-black transition ${
                    active
                      ? "border-[var(--koluj-green)] bg-[var(--koluj-green)] text-white shadow-[var(--koluj-glow)]"
                      : "border-white/80 bg-white/78 text-[var(--koluj-muted)] shadow-sm hover:-translate-y-0.5 hover:bg-white"
                  }`}
                >
                  {chip.icon}
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={buildOffersHref()} className="koluj-button px-6 py-4">
              Procházet nabídky <ArrowRight size={18} />
            </Link>
            <Link
              href="/offers/new"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white px-6 py-4 font-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              Přidat nabídku
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-4 max-w-[1500px]">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="koluj-pill w-fit">
                {totalItems.toLocaleString("cs-CZ")} aktuálních nabídek
              </p>
              <h2 className="koluj-section-title mt-4">Právě kolují</h2>
              <p className="mt-2 max-w-2xl text-[var(--koluj-muted)]">
                Skutečné nabídky z databáze. Žádná smyšlená čísla.
              </p>
            </div>
            <Link
              href={buildOffersHref()}
              className="hidden items-center gap-2 font-black text-[var(--koluj-green)] sm:flex"
            >
              Zobrazit vše <ArrowRight size={18} />
            </Link>
          </div>

          {displayedItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {displayedItems.map((item) => (
                <OfferCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="koluj-card p-8 text-[var(--koluj-muted)]">
              Zatím tu nejsou žádné nabídky.
            </div>
          )}
        </section>

        <section id="jak" className="mx-auto mt-16 grid max-w-[1500px] gap-5 lg:grid-cols-3">
          <div className="koluj-card p-7">
            <p className="koluj-pill w-fit">1</p>
            <h3 className="mt-5 text-2xl font-black tracking-[-0.04em]">Najdi nabídku</h3>
            <p className="mt-3 text-[var(--koluj-muted)]">
              Vyhledej věc nebo službu a otevři detail nabídky.
            </p>
          </div>
          <div className="koluj-card p-7">
            <p className="koluj-pill w-fit">2</p>
            <h3 className="mt-5 text-2xl font-black tracking-[-0.04em]">Pošli žádost</h3>
            <p className="mt-3 text-[var(--koluj-muted)]">
              U věcí vybereš termín. U služeb čas nebo pošleš poptávku.
            </p>
          </div>
          <div className="koluj-card p-7">
            <p className="koluj-pill w-fit">3</p>
            <h3 className="mt-5 text-2xl font-black tracking-[-0.04em]">Domluvte se</h3>
            <p className="mt-3 text-[var(--koluj-muted)]">
              V rezervaci máte chat, stav žádosti a další kroky.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
