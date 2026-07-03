"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, LocateFixed, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import { getDistanceKm } from "@/lib/location";
import AddOfferButton from "@/app/components/AddOfferButton";

const OffersMap = dynamic(() => import("@/app/components/OffersMap"), {
  ssr: false,
});

const DISPLAYED_ITEMS_COUNT = 8;
type OfferTypeFilter = "all" | "item" | "service";

function getOfferType(item: OfferCardOffer) {
  return ((item as OfferCardOffer & { offer_type?: string }).offer_type || "item") as "item" | "service";
}

async function attachTodayAvailability<T extends { id: string }>(items: T[]) {
  if (items.length === 0) return items as (T & { is_reserved_today: boolean })[];

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

  if (reservationsResult.error) console.error("Reservations availability error:", reservationsResult.error);
  if (blocksResult.error) console.error("Blocks availability error:", blocksResult.error);

  const reservedIds = new Set([
    ...(reservationsResult.data || []).map((row) => row.offer_id),
    ...(blocksResult.data || []).map((row) => row.offer_id),
  ]);

  return items.map((item) => ({ ...item, is_reserved_today: reservedIds.has(item.id) }));
}

export default function HomePage() {
  const router = useRouter();
  const [items, setItems] = useState<OfferCardOffer[]>([]);
  const [search, setSearch] = useState("");
  const [selectedOfferType, setSelectedOfferType] = useState<OfferTypeFilter>("all");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadItems();
    loadUser();
  }, []);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(Boolean(user));
  }

  async function loadItems() {
    const { data, count } = await supabase
      .from("offers")
      .select(`
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
      `, { count: "exact" })
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(40);

    const itemsWithAvailability = await attachTodayAvailability((data || []) as OfferCardOffer[]);
    setItems(itemsWithAvailability);
    setTotalItems(count || 0);
  }

  function buildOffersHref() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (selectedOfferType !== "all") params.set("type", selectedOfferType);
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
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        toast.success("Poloha nalezena", { id: "location" });
      },
      () => toast.error("Nepodařilo se získat polohu.", { id: "location" }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedOfferType !== "all") result = result.filter((item) => getOfferType(item) === selectedOfferType);
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter((item) => `${item.title} ${item.category} ${item.pickup_place}`.toLowerCase().includes(query));
    }
    if (userLocation) {
      result = [...result].sort((a, b) => {
        const aHasLocation = Boolean(a.pickup_latitude && a.pickup_longitude);
        const bHasLocation = Boolean(b.pickup_latitude && b.pickup_longitude);
        if (!aHasLocation && !bHasLocation) return 0;
        if (!aHasLocation) return 1;
        if (!bHasLocation) return -1;
        return getDistanceKm(userLocation.latitude, userLocation.longitude, a.pickup_latitude!, a.pickup_longitude!) - getDistanceKm(userLocation.latitude, userLocation.longitude, b.pickup_latitude!, b.pickup_longitude!);
      });
    }
    return result;
  }, [items, search, selectedOfferType, userLocation]);

  const displayedItems = filteredItems.slice(0, DISPLAYED_ITEMS_COUNT);

  return (
    <main className="koluj-home min-h-screen overflow-hidden text-[var(--koluj-text)]">
      <div className="koluj-shell-wide relative z-10">
        <header className="koluj-page-header">
          <Link href="/" className="koluj-logo">KOLUJ</Link>

          <div className="flex items-center gap-3">
            <AddOfferButton className="koluj-button hidden items-center gap-2 px-6 py-3 sm:inline-flex" />
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="koluj-button px-5 py-3">
              {isLoggedIn ? "Můj prostor" : "Přihlásit se"}
            </Link>
          </div>
        </header>

        <section className="grid items-center gap-7 pb-8 pt-4 md:pt-6 lg:grid-cols-[0.9fr_1.1fr] lg:pb-10 lg:pt-8">
          <div className="max-w-2xl">
            <h1 className="koluj-heading">
              Sdílej.<br />Půjčuj.<br /><span className="text-[var(--koluj-green)]">Koluj.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-2xl">
              Věci a služby od lidí poblíž.
            </p>

            <div className="mt-7 space-y-4">
              <div className="flex min-h-[60px] items-center gap-2 rounded-[24px] border border-[var(--koluj-border-strong)] bg-white px-3 shadow-sm md:max-w-xl">
                <Search size={22} className="shrink-0 text-[var(--koluj-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                  placeholder="Co hledáš?"
                  className="min-w-0 flex-1 bg-transparent py-4 text-base outline-none placeholder:text-[var(--koluj-muted)] md:text-lg"
                />
                <button type="button" onClick={useMyLocation} className={`hidden items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold sm:inline-flex ${userLocation ? "bg-[var(--koluj-green)] text-white" : "bg-[var(--koluj-green-soft)] text-[var(--koluj-green)]"}`}>
                  <LocateFixed size={17} /> Okolo mě
                </button>
                <button type="button" onClick={submitSearch} className="koluj-button min-h-0 px-4 py-3 text-sm sm:px-5">
                  <span className="hidden sm:inline">Hledat</span><ArrowRight size={17} />
                </button>
              </div>
              <button type="button" onClick={useMyLocation} className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold sm:hidden ${userLocation ? "bg-[var(--koluj-green)] text-white" : "bg-[var(--koluj-green-soft)] text-[var(--koluj-green)]"}`}>
                <LocateFixed size={17} /> Okolo mě
              </button>

              <div className="flex flex-wrap gap-2">
                {([
                  ["all", "Vše"],
                  ["item", "Věci"],
                  ["service", "Služby"],
                ] as [OfferTypeFilter, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedOfferType(value)}
                    className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${selectedOfferType === value ? "border-[var(--koluj-green)] bg-[var(--koluj-green)] text-white" : "border-[var(--koluj-border-strong)] bg-white text-[var(--koluj-muted)] hover:text-[var(--koluj-green)]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

            </div>
          </div>

          <div id="mapa" className="koluj-card h-[260px] overflow-hidden p-2 md:h-[320px] lg:h-[380px]">
            <OffersMap items={filteredItems} userLocation={userLocation} />
          </div>
        </section>

        <section id="nabidky" className="mt-2 md:mt-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="koluj-section-title">Nedávno přidané</h2>
              <p className="mt-2 text-[var(--koluj-muted)]">
                {totalItems > 0 ? `${totalItems.toLocaleString("cs-CZ")} aktivních nabídek na KOLUJ.` : "Vybrané nabídky, které jsou právě dostupné."}
              </p>
            </div>
            <Link href={buildOffersHref()} className="hidden items-center gap-2 font-semibold text-[var(--koluj-green)] sm:flex">Zobrazit vše <ArrowRight size={18} /></Link>
          </div>

          {displayedItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
              {displayedItems.map((item) => <OfferCard key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="koluj-card p-8 text-[var(--koluj-muted)]">Zatím tu nejsou žádné nabídky.</div>
          )}
        </section>

        <section className="mt-14 pb-8 lg:mt-18">
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--koluj-green)]">Jak to funguje</p>
            <h2 className="koluj-section-title mt-2">Jednoduše. Lokálně. Bez bazaru.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
          {[
            ["1", "Najdi poblíž", "Vyhledej věc nebo službu a podívej se, kde je k dispozici."],
            ["2", "Pošli žádost", "U věcí vybereš termín, u služeb odešleš jednoduchou poptávku."],
            ["3", "Domluvte se", "Po schválení se otevře chat pro předání nebo provedení služby."],
          ].map(([number, title, text]) => (
            <div key={number} className="rounded-[28px] border border-[var(--koluj-border)] bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--koluj-green-soft)] text-sm font-bold text-[var(--koluj-green)]">{number}</span>
              <h3 className="mt-5 text-2xl font-semibold tracking-[-0.045em] text-[var(--koluj-ink)]">{title}</h3>
              <p className="mt-3 leading-relaxed text-[var(--koluj-muted)]">{text}</p>
            </div>
          ))}
          </div>
        </section>
      </div>
    </main>
  );
}
