"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, LocateFixed, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import InstallAppButton from "@/app/components/InstallAppButton";
import { getDistanceKm } from "@/lib/location";

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

          <nav className="hidden items-center gap-8 text-sm font-semibold text-[var(--koluj-muted)] lg:flex">
            <Link href="/offers" className="text-[var(--koluj-green)]">Nabídky</Link>
            <a href="#mapa" className="hover:text-[var(--koluj-green)]">Mapa</a>
            <a href="#nabidky" className="hover:text-[var(--koluj-green)]">Nové nabídky</a>
          </nav>

          <div className="flex items-center gap-3">
            <InstallAppButton />
            <Link href="/offers/new" className="hidden rounded-full bg-[var(--koluj-green)] px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5 sm:inline-flex">
              <Plus size={18} /> Přidat nabídku
            </Link>
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="koluj-button px-5 py-3">
              {isLoggedIn ? "Můj prostor" : "Přihlásit se"}
            </Link>
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-96px)] items-center gap-8 py-10 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="max-w-2xl">
            <h1 className="koluj-heading mt-4">
              Sdílej.<br />Půjčuj.<br /><span className="text-[var(--koluj-green)]">Koluj.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-2xl">
              Věci a služby od lidí poblíž.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex min-h-[62px] items-center gap-3 rounded-[24px] border border-[var(--koluj-border-strong)] bg-white px-4 shadow-sm md:max-w-xl">
                <Search size={22} className="shrink-0 text-[var(--koluj-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                  placeholder="Co hledáš?"
                  className="min-w-0 flex-1 bg-transparent py-4 text-base outline-none placeholder:text-[var(--koluj-muted)] md:text-lg"
                />
                <button type="button" onClick={useMyLocation} className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${userLocation ? "bg-[var(--koluj-green)] text-white" : "bg-[var(--koluj-green-soft)] text-[var(--koluj-green)]"}`}>
                  <LocateFixed size={17} /> Okolo mě
                </button>
              </div>

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

              <button type="button" onClick={submitSearch} className="koluj-button px-7 py-4">
                Hledat <ArrowRight size={18} />
              </button>
            </div>
          </div>

          <div id="mapa" className="koluj-card h-[360px] overflow-hidden p-2 md:h-[520px] lg:h-[680px]">
            <OffersMap items={filteredItems} userLocation={userLocation} />
          </div>
        </section>

        <section id="nabidky" className="mt-4 md:mt-10">
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
      </div>
    </main>
  );
}
