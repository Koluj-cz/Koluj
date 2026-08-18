"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  CalendarDays,
  LocateFixed,
  MapPin,
  PackageSearch,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import InstallAppButton from "@/app/components/InstallAppButton";
import SmartSearchSuggestions from "@/app/components/search/SmartSearchSuggestions";
import type { SearchIntentMatch, SearchIntentRecommendation } from "@/lib/services/searchIntentService";
import { getCleanSearchQuery } from "@/lib/services/searchService";
import { parseSearchDate, stripSearchDate } from "@/lib/services/searchDateService";
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

const SEARCH_PLACEHOLDER_EXAMPLES = [
  "Hledám vrtačku",
  "Potřebuji vymalovat pokoj",
  "Chci postavit pergolu",
  "Potřebuji přestěhovat lednici",
  "Chci upravit zahradu",
  "Potřebuji elektrikáře",
  "Hledám přívěsný vozík",
  "Sháním sekačku na víkend",
  "Potřebuji opravit kapající kohoutek",
  "Hledám žebřík",
  "Potřebuji odvézt starý nábytek",
  "Sháním tepovač na koberec",
  "Potřebuji smontovat skříň",
  "Hledám dodávku na stěhování",
  "Potřebuji posekat zahradu",
  "Sháním motorovou pilu",
  "Potřebuji opravit zásuvku",
  "Hledám střešní box",
  "Potřebuji vykopat základy",
  "Sháním párty stan",
  "Potřebuji položit podlahu",
  "Hledám štípačku na dřevo",
  "Potřebuji instalatéra",
  "Sháním míchačku na beton",
  "Potřebuji prořezat stromy",
  "Hledám vysokotlaký čistič",
  "Potřebuji opravit plot",
  "Sháním vozík za auto",
  "Potřebuji složit nábytek",
  "Hledám lešení",
] as const;

function useTypewriterPlaceholder(paused: boolean) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [visibleText, setVisibleText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (paused) return;

    const currentExample = SEARCH_PLACEHOLDER_EXAMPLES[exampleIndex];

    let delay = isDeleting ? 35 : 75;

    if (!isDeleting && visibleText === currentExample) {
      delay = 1800;
    }

    if (isDeleting && visibleText.length === 0) {
      delay = 450;
    }

    const timer = window.setTimeout(() => {
      if (!isDeleting && visibleText === currentExample) {
        setIsDeleting(true);
        return;
      }

      if (isDeleting && visibleText.length === 0) {
        setIsDeleting(false);
        setExampleIndex(
          (current) =>
            (current + 1) % SEARCH_PLACEHOLDER_EXAMPLES.length,
        );
        return;
      }

      setVisibleText(
        isDeleting
          ? currentExample.slice(
              0,
              Math.max(0, visibleText.length - 1),
            )
          : currentExample.slice(0, visibleText.length + 1),
      );
    }, delay);

    return () => window.clearTimeout(timer);
  }, [exampleIndex, isDeleting, paused, visibleText]);

  return `${visibleText}|`;
}

type OfferTypeFilter = "all" | "item" | "service";

function getCategoryLabel(category: string, offerType: OfferTypeFilter) {
  if (offerType === "service") return serviceCategoryLabels[category] || category;
  return categoryLabels[category] || serviceCategoryLabels[category] || category;
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
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [smartIntent, setSmartIntent] = useState<SearchIntentMatch | null>(null);
  const [dismissedIntentQuery, setDismissedIntentQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [placeholderResumeReady, setPlaceholderResumeReady] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [suggestions, setSuggestions] = useState<{ offers: Array<{ id: string; title: string; offer_type: string; category: string; pickup_place: string; price_amount: number | null; price_unit: string | null }>; categories: Array<{ value: string; label: string }> }>({ offers: [], categories: [] });
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const loadingRef = useRef(false);
  const pageRef = useRef(0);
  const requestIdRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const placeholderResumeTimerRef = useRef<number | null>(null);
  const animatedSearchPlaceholder = useTypewriterPlaceholder(
    searchFocused || !placeholderResumeReady || Boolean(search),
  );

  const serverSearchQuery = useMemo(
    () => getCleanSearchQuery(stripSearchDate(debouncedSearch)),
    [debouncedSearch],
  );

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

  const parsedSearchDate = useMemo(
    () => parseSearchDate(debouncedSearch),
    [debouncedSearch],
  );

  const effectiveDateFrom = parsedSearchDate?.dateFrom || dateFrom;
  const effectiveDateTo = parsedSearchDate?.dateTo || dateTo || effectiveDateFrom;
  const effectiveDateLabel = parsedSearchDate?.label || dateLabel;

  useEffect(() => {
    const query = stripSearchDate(debouncedSearch).trim();
    if (!searchFocused || query.length < 2) {
      setSuggestions({ offers: [], categories: [] });
      setSuggestionsOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: query, offerType: selectedOfferType });
      if (selectedCategory) params.set("category", selectedCategory);
      if (effectiveDateFrom) params.set("dateFrom", effectiveDateFrom);
      if (effectiveDateTo) params.set("dateTo", effectiveDateTo);
      try {
        const response = await fetch(`/api/search/suggestions?${params}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json().catch(() => null);
        if (response.ok) {
          setSuggestions({ offers: result?.offers || [], categories: result?.categories || [] });
          setSuggestionsOpen(Boolean(result?.offers?.length || result?.categories?.length));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) console.error("Search suggestions error:", error);
      }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [debouncedSearch, searchFocused, selectedOfferType, selectedCategory, effectiveDateFrom, effectiveDateTo]);

  useEffect(() => {
    return () => {
      if (placeholderResumeTimerRef.current !== null) {
        window.clearTimeout(placeholderResumeTimerRef.current);
      }
    };
  }, []);

  function pauseSearchPlaceholder() {
    if (placeholderResumeTimerRef.current !== null) {
      window.clearTimeout(placeholderResumeTimerRef.current);
      placeholderResumeTimerRef.current = null;
    }
    setSearchFocused(true);
    setPlaceholderResumeReady(false);
  }

  function resumeSearchPlaceholder() {
    setSearchFocused(false);
    if (search.trim()) return;

    placeholderResumeTimerRef.current = window.setTimeout(() => {
      setPlaceholderResumeReady(true);
      placeholderResumeTimerRef.current = null;
    }, 1400);
  }

  useEffect(() => {
    const query = debouncedSearch.trim();
    if (query.length < 3 || query === dismissedIntentQuery) {
      setSmartIntent(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/intents?q=${encodeURIComponent(stripSearchDate(query))}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        if (response.ok) setSmartIntent(result?.intent || null);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Smart search intent error:", error);
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [debouncedSearch, dismissedIntentQuery]);

  const loadUser = useCallback(async () => {
    const response = await fetch("/api/me", { cache: "no-store" });
    setIsLoggedIn(response.ok);
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const loadItems = useCallback(
    async ({ reset = false }: { reset?: boolean } = {}) => {
      if (loadingRef.current) return;

      const nextPage = reset ? 0 : pageRef.current;
      const from = nextPage * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      const requestId = requestIdRef.current + 1;

      requestIdRef.current = requestId;
      loadingRef.current = true;
      setIsLoading(true);

      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(ITEMS_PER_PAGE),
        offerType: selectedOfferType,
      });

      if (selectedCategory) params.set("category", selectedCategory);
      if (serverSearchQuery) params.set("q", serverSearchQuery);
      if (effectiveDateFrom) params.set("dateFrom", effectiveDateFrom);
      if (effectiveDateTo) params.set("dateTo", effectiveDateTo);

      const response = await fetch(`/api/offers/public?${params.toString()}`, {
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        console.error("Offers load error:", result?.error);
        toast.error(result?.error || "Nepodařilo se načíst nabídky.");
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      const itemsWithAvailability = (result?.offers || []) as OfferCardOffer[];
      const count = Number(result?.count || 0);

      setItems((currentItems) => (reset ? itemsWithAvailability : [...currentItems, ...itemsWithAvailability]));
      setTotalItems(count);
      setHasMoreItems(to + 1 < count);
      pageRef.current = nextPage + 1;
      setIsLoading(false);
      loadingRef.current = false;
    },
    [selectedCategory, selectedOfferType, serverSearchQuery, effectiveDateFrom, effectiveDateTo],
  );

  useEffect(() => {
    pageRef.current = 0;
    setHasMoreItems(true);
    void loadItems({ reset: true });
  }, [loadItems]);

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

  function selectSmartRecommendation(recommendation: SearchIntentRecommendation) {
    const nextType = recommendation.offerType || "all";
    const nextSearch = recommendation.searchQuery || "";
    setSelectedOfferType(nextType);
    setSelectedCategory(recommendation.category || "");
    setSearch(nextSearch);
    setDismissedIntentQuery(nextSearch || debouncedSearch);
    setSmartIntent(null);
    window.requestAnimationFrame(() => {
      document.getElementById("nabidky")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <main className="koluj-home koluj-home-marketplace min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card koluj-home-hero grid gap-6 p-5 min-[1100px]:hidden">
          <div className="flex flex-col justify-center">
            <h1 className="koluj-heading mt-0">
              Sdílej. Půjčuj. <span className="text-[var(--koluj-green)]">Koluj.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)]">
              Věci i služby, které dávají smysl – pro tebe, sousedy i planetu.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#nabidky" className="koluj-button h-[52px] px-6">
                Procházet nabídky <ArrowRight size={18} />
              </a>
              <InstallAppButton iconOnly />
            </div>
          </div>
        </section>

        <div className="koluj-wide-layout koluj-home-layout">
          <aside className="koluj-wide-sidebar koluj-home-sidebar koluj-search-sidebar min-w-0 max-w-full overflow-hidden" aria-label="Filtry nabídek">
            <div className="koluj-sidebar-content min-w-0 max-w-full">
              <div className="koluj-search-sidebar-intro">
                <h2>Najděte, co potřebujete</h2>
                <p>Věci i služby ve vašem okolí</p>
              </div>

              <div className="koluj-search-sidebar-search">
                <div className="relative">
                  <div className="flex min-h-[52px] items-center gap-3 rounded-[18px] border border-[var(--koluj-border)] bg-white px-4 shadow-sm transition focus-within:border-[var(--koluj-green)] focus-within:shadow-[0_10px_28px_rgba(22,163,74,.10)]">
                    <Search size={19} className="shrink-0 text-[var(--koluj-muted)]" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onFocus={pauseSearchPlaceholder}
                      onBlur={resumeSearchPlaceholder}
                      placeholder={
                        searchFocused
                          ? "Co chcete udělat nebo co hledáte?"
                          : animatedSearchPlaceholder
                      }
                      className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold outline-none placeholder:text-slate-400"
                    />
                  </div>

                  {suggestionsOpen && (
                    <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[18px] border border-[var(--koluj-border)] bg-white shadow-xl">
                      {suggestions.offers.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--koluj-muted)]">Aktuální nabídky</p>
                          {suggestions.offers.map((offer) => (
                            <Link key={offer.id} href={`/offers/${offer.id}`} onMouseDown={(e) => e.preventDefault()} className="block rounded-xl px-3 py-2.5 hover:bg-[var(--koluj-green-pale)]">
                              <p className="truncate text-sm font-black">{offer.title}</p>
                              <p className="mt-0.5 truncate text-xs font-bold text-[var(--koluj-muted)]">{offer.offer_type === "service" ? "Služba" : "Věc"} · {offer.pickup_place}</p>
                            </Link>
                          ))}
                        </div>
                      )}
                      {suggestions.categories.length > 0 && (
                        <div className="border-t border-[var(--koluj-border)] p-2">
                          <p className="px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--koluj-muted)]">Kategorie</p>
                          {suggestions.categories.map((category) => (
                            <button key={category.value} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSelectedCategory(category.value); setSuggestionsOpen(false); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-black hover:bg-[var(--koluj-green-pale)]">{category.label}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="koluj-search-filter-section">
                <SearchFilterHeading icon={<CalendarDays size={17} />} title="Kdy to potřebujete?" />
                <div className="koluj-search-filter-card">
                  <div className="grid grid-cols-[minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-2">
                    <input aria-label="Od data" type="date" value={effectiveDateFrom} onChange={(e) => { if (parsedSearchDate) setSearch(stripSearchDate(search)); setDateFrom(e.target.value); if (!dateTo || dateTo < e.target.value) setDateTo(e.target.value); setDateLabel(""); }} className="koluj-search-date-input" />
                    <span className="text-center text-sm font-black text-[var(--koluj-muted)]">→</span>
                    <input aria-label="Do data" type="date" min={effectiveDateFrom || undefined} value={effectiveDateTo} onChange={(e) => { if (parsedSearchDate) setSearch(stripSearchDate(search)); setDateTo(e.target.value); setDateLabel(""); }} className="koluj-search-date-input" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Dnes", "Zítra", "Tento víkend"].map((label) => (
                      <button key={label} type="button" onClick={() => { const parsed = parseSearchDate(label); if (parsed) { if (parsedSearchDate) setSearch(stripSearchDate(search)); setDateFrom(parsed.dateFrom); setDateTo(parsed.dateTo); setDateLabel(parsed.label); } }} className="koluj-search-quick-chip">{label}</button>
                    ))}
                  </div>
                  {effectiveDateFrom && (
                    <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setDateLabel(""); if (parsedSearchDate) setSearch(stripSearchDate(search)); }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-[var(--koluj-muted)] hover:text-[var(--koluj-green)]"><X size={14} /> Zrušit termín</button>
                  )}
                </div>
              </div>

              <div className="koluj-search-filter-section">
                <SearchFilterHeading icon={<MapPin size={17} />} title="Kde to hledáte?" />
                <button type="button" onClick={useMyLocation} className="koluj-search-location-button" data-active={Boolean(userLocation)}>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-black text-[var(--koluj-ink)]">{userLocation ? "Moje poloha je aktivní" : "Použít moji polohu"}</span>
                    <span className="mt-0.5 block text-xs font-bold text-[var(--koluj-muted)]">{userLocation ? "Nejbližší nabídky řadíme jako první." : "Seřadíme nejbližší nabídky jako první."}</span>
                  </span>
                  <LocateFixed size={19} className="shrink-0 text-[var(--koluj-green)]" />
                </button>
              </div>

              <div className="koluj-search-filter-section">
                <SearchFilterHeading icon={<PackageSearch size={17} />} title="Co hledáte?" />
                <div className="grid min-w-0 grid-cols-3 gap-2">
                  {offerTypeTabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => selectOfferType(tab.value)}
                      className="koluj-sidebar-tile min-h-[46px] min-w-0 px-2 text-sm"
                      data-active={selectedOfferType === tab.value}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-xs font-black text-[var(--koluj-muted)]">Kategorie</label>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="koluj-select mt-2 font-bold"
                >
                  <option value="">Všechny kategorie</option>
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {getCategoryLabel(category, selectedOfferType)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="koluj-search-sidebar-footer">
                <div className="flex min-w-0 max-w-full flex-wrap gap-x-3 gap-y-2 text-sm font-bold text-[var(--koluj-muted)]">
                  <Link href="/legal/terms" className="hover:text-[var(--koluj-green)]">Podmínky</Link>
                  <Link href="/legal/privacy" className="hover:text-[var(--koluj-green)]">Soukromí</Link>
                  <Link href="/legal/cookies" className="hover:text-[var(--koluj-green)]">Cookies</Link>
                  <a href="mailto:info@koluj.cz" className="hover:text-[var(--koluj-green)]">Kontakt</a>
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] opacity-60">© {new Date().getFullYear()} Koluj</p>
              </div>
            </div>
          </aside>

          <div className="koluj-main-wide koluj-home-content">
            <section className="koluj-hero-card koluj-home-hero hidden gap-6 p-5 min-[1100px]:grid min-[1100px]:p-8 xl:grid-cols-[0.7fr_1.3fr] xl:p-8">
              <div className="flex flex-col justify-center">
                <h1 className="koluj-heading mt-0">
                  Sdílej. Půjčuj. <span className="text-[var(--koluj-green)]">Koluj.</span>
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
                  Věci i služby, které dávají smysl – pro tebe, sousedy i planetu.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a href="#nabidky" className="koluj-button h-[52px] px-6">
                    Procházet nabídky <ArrowRight size={18} />
                  </a>

                  <InstallAppButton iconOnly />

                  <Link
                    href={isLoggedIn ? "/dashboard" : "/login"}
                    prefetch={false}
                    className="koluj-button-secondary flex h-[52px] w-[52px] shrink-0 items-center justify-center p-0"
                    aria-label={isLoggedIn ? "Můj prostor" : "Přihlásit se"}
                    title={isLoggedIn ? "Můj prostor" : "Přihlásit se"}
                  >
                    <User size={20} />
                  </Link>

                  <Link
                    href="/offers/new"
                    prefetch={false}
                    className="koluj-button flex h-[52px] w-[52px] shrink-0 items-center justify-center p-0"
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

              {effectiveDateFrom && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--koluj-green-pale)] px-3 py-2 text-sm font-black text-[var(--koluj-green)]">
                    <CalendarDays size={16} /> {effectiveDateLabel || (effectiveDateFrom === effectiveDateTo ? new Date(`${effectiveDateFrom}T12:00:00`).toLocaleDateString("cs-CZ") : `${new Date(`${effectiveDateFrom}T12:00:00`).toLocaleDateString("cs-CZ")} – ${new Date(`${effectiveDateTo}T12:00:00`).toLocaleDateString("cs-CZ")}`)}
                    <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setDateLabel(""); if (parsedSearchDate) setSearch(stripSearchDate(search)); }} aria-label="Zrušit termín"><X size={15} /></button>
                  </span>
                </div>
              )}

              {smartIntent && (
                <SmartSearchSuggestions
                  intent={smartIntent}
                  onSelect={selectSmartRecommendation}
                  onDismiss={() => {
                    setDismissedIntentQuery(debouncedSearch);
                    setSmartIntent(null);
                  }}
                />
              )}

              {sortedItems.length > 0 ? (
                <div className="koluj-offer-grid-wide">
                  {sortedItems.map((item) => <OfferCard key={item.id} item={item} />)}
                </div>
              ) : !isLoading ? (
                <div className="koluj-card p-8 text-[var(--koluj-muted)]">
                  <p className="font-black text-[var(--koluj-text)]">{effectiveDateFrom ? "V tomto termínu jsme nenašli volnou nabídku." : "Zatím tu nejsou žádné nabídky."}</p>
                  {effectiveDateFrom && <p className="mt-2 text-sm font-bold">Zkus zrušit termín nebo upravit kategorii či hledaný výraz.</p>}
                </div>
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

function SearchFilterHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="koluj-search-section-icon">{icon}</span>
      <h3 className="text-sm font-black text-[var(--koluj-ink)]">{title}</h3>
    </div>
  );
}
