"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Leaf,
  LocateFixed,
  Plus,
  Search,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import InstallAppButton from "@/app/components/InstallAppButton";
import { getDistanceKm } from "@/lib/location";
import {
  categories as itemCategories,
  categoryLabels,
  offerTypeTabs,
  serviceCategories,
  serviceCategoryLabels,
} from "@/lib/constants";

const OffersMap = dynamic(() => import("@/app/components/OffersMap"), { ssr: false });

const ITEMS_PER_PAGE = 10;

type OfferTypeFilter = "all" | "item" | "service";

function getCategoryLabel(category: string, offerType: OfferTypeFilter) {
  if (offerType === "service") return serviceCategoryLabels[category] || category;
  return categoryLabels[category] || serviceCategoryLabels[category] || category;
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
  const [items, setItems] = useState<OfferCardOffer[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedOfferType, setSelectedOfferType] = useState<OfferTypeFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(true);

  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const availableCategories = useMemo(() => {
    if (selectedOfferType === "item") return [...itemCategories];
    if (selectedOfferType === "service") return [...serviceCategories];

    return [
      ...itemCategories,
      ...serviceCategories.filter((category) => !itemCategories.includes(category as (typeof itemCategories)[number])),
    ];
  }, [selectedOfferType]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsLoggedIn(Boolean(user));
  }

  const loadItems = useCallback(
    async ({ reset = false }: { reset?: boolean } = {}) => {
      if (loadingRef.current) return;

      const nextPage = reset ? 0 : page;
      const from = nextPage * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      loadingRef.current = true;
      setIsLoading(true);

      let query = supabase
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
        .range(from, to);

      if (selectedOfferType !== "all") {
        query = query.eq("offer_type", selectedOfferType);
      }

      if (selectedCategory) {
        query = query.eq("category", selectedCategory);
      }

      if (debouncedSearch) {
        const normalizedSearch = debouncedSearch.replaceAll(",", " ");
        query = query.or(
          `title.ilike.%${normalizedSearch}%,description.ilike.%${normalizedSearch}%,category.ilike.%${normalizedSearch}%,pickup_place.ilike.%${normalizedSearch}%`,
        );
      }

      const { data, count, error } = await query;

      if (error) {
        console.error("Offers load error:", error);
        toast.error("Nepodařilo se načíst nabídky.");
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      const itemsWithAvailability = await attachTodayAvailability((data || []) as OfferCardOffer[]);

      setItems((currentItems) => (reset ? itemsWithAvailability : [...currentItems, ...itemsWithAvailability]));
      setTotalItems(count || 0);
      setHasMoreItems(to + 1 < (count || 0));
      setPage(nextPage + 1);
      setIsLoading(false);
      loadingRef.current = false;
    },
    [debouncedSearch, page, selectedCategory, selectedOfferType],
  );

  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMoreItems(true);
    void loadItems({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedCategory, selectedOfferType]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0]?.isIntersecting;
        if (isVisible && hasMoreItems && !loadingRef.current) {
          void loadItems();
        }
      },
      { rootMargin: "500px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreItems, loadItems]);

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

  const sortedItems = useMemo(() => {
    if (!userLocation) return items;

    return [...items].sort((a, b) => {
      const aHasLocation = Boolean(a.pickup_latitude && a.pickup_longitude);
      const bHasLocation = Boolean(b.pickup_latitude && b.pickup_longitude);

      if (!aHasLocation && !bHasLocation) return 0;
      if (!aHasLocation) return 1;
      if (!bHasLocation) return -1;

      return (
        getDistanceKm(userLocation.latitude, userLocation.longitude, a.pickup_latitude!, a.pickup_longitude!) -
        getDistanceKm(userLocation.latitude, userLocation.longitude, b.pickup_latitude!, b.pickup_longitude!)
      );
    });
  }, [items, userLocation]);

  function selectOfferType(type: OfferTypeFilter) {
    setSelectedOfferType(type);
    setSelectedCategory("");
  }

  return (
    <main className="koluj-home koluj-home-marketplace min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card koluj-home-hero grid gap-6 p-5 md:hidden">
          <div className="flex flex-col justify-center">
            <h1 className="koluj-heading mt-0">
              Sdílej. Půjčuj. <span className="text-[var(--koluj-green)]">Koluj.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)]">
              Věci i služby, které dávají smysl – pro tebe, pro sousedy i pro planetu.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#nabidky" className="koluj-button min-h-[52px] px-6">
                Procházet nabídky <ArrowRight size={18} />
              </a>
              <div className="inline-flex [&_button]:min-h-[52px] [&_button]:w-[52px] [&_button]:px-0 [&_button_span]:sr-only">
                <InstallAppButton />
              </div>
            </div>
          </div>
        </section>

        <div className="koluj-wide-layout koluj-home-layout">
          <aside className="koluj-wide-sidebar koluj-home-sidebar" aria-label="Filtry nabídek">
            <div className="koluj-sidebar-content">
              <div className="koluj-sidebar-section pt-4">
                <p className="koluj-sidebar-label">Hledání</p>
                <div className="flex min-h-[48px] items-center gap-2 rounded-[16px] border border-[var(--koluj-border)] bg-white px-4 shadow-sm">
                  <Search size={18} className="shrink-0 text-[var(--koluj-muted)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Co hledáte?"
                    className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={useMyLocation}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--koluj-green)] hover:bg-[var(--koluj-green-pale)]"
                    data-active={Boolean(userLocation)}
                    aria-label="Použít moji polohu"
                    title="Použít moji polohu"
                  >
                    <LocateFixed size={18} />
                  </button>
                </div>
              </div>

              <div className="koluj-sidebar-section">
                <p className="koluj-sidebar-label">Typ nabídky</p>
                <div className="grid grid-cols-3 gap-2">
                  {offerTypeTabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => selectOfferType(tab.value)}
                      className="koluj-sidebar-tile min-h-[44px]"
                      data-active={selectedOfferType === tab.value}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="koluj-sidebar-section">
                <p className="koluj-sidebar-label">Kategorie</p>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="koluj-select font-bold"
                >
                  <option value="">Všechny kategorie</option>
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {getCategoryLabel(category, selectedOfferType)}
                    </option>
                  ))}
                </select>
              </div>

              <div id="jak" className="koluj-sidebar-section hidden md:block">
                <p className="koluj-sidebar-label">Jak to funguje</p>
                <div className="grid gap-3">
                  <InfoCard icon={<Search />} title="Najdi" text="Vyhledej věc nebo službu ve svém okolí." compact />
                  <InfoCard icon={<ArrowRight />} title="Domluv se" text="Otevři detail a domluv termín." compact />
                  <InfoCard icon={<Leaf />} title="Nech kolovat" text="Sdílej věci, které už existují." compact />
                </div>
              </div>

              <div className="mt-6 hidden flex-wrap gap-4 text-sm font-bold text-[var(--koluj-muted)] md:flex">
                <Link href="/legal/terms" className="hover:text-[var(--koluj-green)]">
                  Podmínky
                </Link>

                <Link href="/legal/privacy" className="hover:text-[var(--koluj-green)]">
                  Soukromí
                </Link>

                <Link href="/legal/cookies" className="hover:text-[var(--koluj-green)]">
                  Cookies
                </Link>

                <a href="mailto:info@koluj.cz" className="hover:text-[var(--koluj-green)]">
                  Kontakt
                </a>
              </div>

              <p className="mt-3 hidden text-xs font-bold uppercase tracking-[0.12em] opacity-60 md:block">
                © {new Date().getFullYear()} KOLUJ
              </p>
            </div>
          </aside>

          <div className="koluj-main-wide koluj-home-content">
            <section className="koluj-hero-card koluj-home-hero hidden gap-6 p-5 md:grid md:p-8 xl:grid-cols-[0.7fr_1.3fr] xl:p-8">
              <div className="flex flex-col justify-center">
                <h1 className="koluj-heading mt-0">
                  Sdílej. Půjčuj. <span className="text-[var(--koluj-green)]">Koluj.</span>
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
                  Věci i služby, které dávají smysl – pro tebe, pro sousedy i pro planetu.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a href="#nabidky" className="koluj-button min-h-[52px] px-6">
                    Procházet nabídky <ArrowRight size={18} />
                  </a>

                  <div className="inline-flex [&_button]:min-h-[52px] [&_button]:w-[52px] [&_button]:px-0 [&_button_span]:sr-only">
                    <InstallAppButton />
                  </div>

                  <Link
                    href={isLoggedIn ? "/dashboard" : "/login"}
                    className="koluj-button-secondary min-h-[52px] w-[52px] px-0"
                    aria-label={isLoggedIn ? "Můj prostor" : "Přihlásit se"}
                    title={isLoggedIn ? "Můj prostor" : "Přihlásit se"}
                  >
                    <User size={20} />
                  </Link>

                  <Link
                    href="/offers/new"
                    className="koluj-button min-h-[52px] w-[52px] px-0"
                    aria-label="Přidat nabídku"
                    title="Přidat nabídku"
                  >
                    <Plus size={22} />
                  </Link>
                </div>
              </div>

              <div className="koluj-hero-map" aria-label="Mapa nabídek v okolí">
                <OffersMap items={sortedItems} userLocation={userLocation} />
              </div>
            </section>

            <section id="nabidky" className="mt-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black tracking-[-0.035em] text-[var(--koluj-ink)]">Právě kolují</h2>
                  <p className="mt-2 text-[var(--koluj-muted)]">
                    {totalItems > 0
                      ? `${totalItems.toLocaleString("cs-CZ")} aktivních nabídek podle aktuálních filtrů.`
                      : "Vybrané nabídky, které jsou právě dostupné."}
                  </p>
                </div>
              </div>

              {sortedItems.length > 0 ? (
                <div className="koluj-offer-grid-wide">
                  {sortedItems.map((item) => <OfferCard key={item.id} item={item} />)}
                </div>
              ) : !isLoading ? (
                <div className="koluj-card p-8 text-[var(--koluj-muted)]">Zatím tu nejsou žádné nabídky.</div>
              ) : null}

              <div ref={sentinelRef} className="h-10" />

              {isLoading && (
                <div className="koluj-card mt-5 flex items-center justify-center p-5 text-sm font-black text-[var(--koluj-muted)]">
                  Načítám další nabídky...
                </div>
              )}

              {!hasMoreItems && sortedItems.length > 0 && (
                <p className="py-8 text-center text-sm font-bold text-[var(--koluj-muted)]">
                  Zobrazeny všechny nabídky.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  text,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  compact?: boolean;
}) {
  return (
    <div className={`koluj-card flex items-start gap-4 ${compact ? "p-4" : "p-5"}`}>
      <div className="koluj-icon-bubble shrink-0">{icon}</div>
      <div>
        <p className={compact ? "font-black" : "text-xl font-black"}>{title}</p>
        <p className="mt-1 text-sm font-bold leading-relaxed text-[var(--koluj-muted)]">{text}</p>
      </div>
    </div>
  );
}
