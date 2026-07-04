"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  LocateFixed,
  Map,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import AuthHeaderButton from "@/app/components/AuthHeaderButton";
import PageLoader from "@/app/components/PageLoader";
import BackLink from "@/app/components/BackLink";
import OfferSearchFilters from "@/app/components/OfferSearchFilters";
import {
  categories,
  categoryLabels,
  serviceCategories,
  serviceCategoryLabels,
  offerTypeLabels,
} from "@/lib/constants";
import { getDistanceKm } from "@/lib/location";

const OffersMap = dynamic(() => import("@/app/components/OffersMap"), {
  ssr: false,
});

function getCategoryOptions(offerType: string) {
  if (offerType === "service") {
    return {
      all: "Všechny kategorie",
      ...Object.fromEntries(serviceCategories.map((c) => [c, serviceCategoryLabels[c]])),
    };
  }

  if (offerType === "item") {
    return {
      all: "Všechny kategorie",
      ...Object.fromEntries(categories.map((c) => [c, categoryLabels[c]])),
    };
  }

  return {
    all: "Všechny kategorie",
    ...Object.fromEntries(categories.map((c) => [c, categoryLabels[c]])),
    ...Object.fromEntries(serviceCategories.map((c) => [c, serviceCategoryLabels[c]])),
  };
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


const statusOptions = {
  available: "Volné",
  reserved: "Rezervované",
  all: "Všechny stavy",
};

export default function ItemsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ItemsPageContent />
    </Suspense>
  );
}

function ItemsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<OfferCardOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [offerType, setOfferType] = useState(searchParams.get("type") || "all");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [status, setStatus] = useState(searchParams.get("status") || "available");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "newest");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [visibleCount, setVisibleCount] = useState(15);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    setVisibleCount(15);
  }, [search, offerType, category, status, sortBy, userLocation]);

  async function loadItems() {
    const { data, error } = await supabase
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
        `
      )
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      setLoading(false);
      return;
    }

    const itemsWithAvailability = await attachTodayAvailability(
      ((data || []) as OfferCardOffer[])
    );

    setItems(itemsWithAvailability);
    setLoading(false);
  }

  function updateUrl(next?: {
    search?: string;
    offerType?: string;
    category?: string;
    status?: string;
    sortBy?: string;
  }) {
    const params = new URLSearchParams();

    const nextSearch = next?.search ?? search;
    const nextOfferType = next?.offerType ?? offerType;
    const nextCategory = next?.category ?? category;
    const nextStatus = next?.status ?? status;
    const nextSortBy = next?.sortBy ?? sortBy;

    if (nextSearch.trim()) params.set("search", nextSearch.trim());
    if (nextOfferType !== "all") params.set("type", nextOfferType);
    if (nextCategory !== "all") params.set("category", nextCategory);
    if (nextStatus !== "available") params.set("status", nextStatus);
    if (nextSortBy !== "newest") params.set("sort", nextSortBy);

    router.replace(`/offers${params.toString() ? `?${params.toString()}` : ""}`);
  }


  function submitSearch() {
    updateUrl({ search });
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((position) => {
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    });
  }

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter((item) =>
        `${item.title} ${item.category} ${item.pickup_place} ${
          item.description || ""
        }`
          .toLowerCase()
          .includes(query)
      );
    }

    if (offerType !== "all") {
      result = result.filter((item) => (item.offer_type || "item") === offerType);
    }

    if (category !== "all") {
      result = result.filter((item) => item.category === category);
    }

    if (status === "available") {
      result = result.filter((item) => !item.is_reserved_today);
    }

    if (status === "reserved") {
      result = result.filter((item) => item.is_reserved_today);
    }

    if (userLocation) {
      return result.sort((a, b) => {
        const aHasLocation = Boolean(a.pickup_latitude && a.pickup_longitude);
        const bHasLocation = Boolean(b.pickup_latitude && b.pickup_longitude);

        if (!aHasLocation && !bHasLocation) return 0;
        if (!aHasLocation) return 1;
        if (!bHasLocation) return -1;

        const distanceA = getDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          a.pickup_latitude!,
          a.pickup_longitude!
        );

        const distanceB = getDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          b.pickup_latitude!,
          b.pickup_longitude!
        );

        return distanceA - distanceB;
      });
    }

    if (sortBy === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    if (sortBy === "oldest") {
      result.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    if (sortBy === "az") {
      result.sort((a, b) => a.title.localeCompare(b.title, "cs"));
    }

    if (sortBy === "za") {
      result.sort((a, b) => b.title.localeCompare(a.title, "cs"));
    }

    return result;
  }, [items, search, offerType, category, status, sortBy, userLocation]);

  const visibleItems = filteredItems.slice(0, visibleCount);

  useEffect(() => {
    if (viewMode !== "list") return;
    if (visibleCount >= filteredItems.length) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];

        if (firstEntry.isIntersecting) {
          setVisibleCount((current) =>
            Math.min(current + 15, filteredItems.length)
          );
        }
      },
      {
        root: null,
        rootMargin: "500px",
        threshold: 0,
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [filteredItems.length, visibleCount, viewMode]);

  if (loading) {
    return (
      <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
        <PageLoader />
      </main>
    );
  }

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackLink href="/">Domů</BackLink>
            <AuthHeaderButton />
          </div>

          <h1 className="koluj-heading mt-6">Nabídky</h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Procházej věci a služby, které právě kolují.
          </p>
        </section>

        <section className="mt-10 md:mt-12">
          <h1 className="koluj-heading">Všechny nabídky</h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Procházej nabídky k rezervaci, filtruj podle kategorií, stavu nebo hledej
            konkrétní nabídku.
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold text-[var(--koluj-green)]">
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">
              {filteredItems.length} výsledků
            </span>
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">
              Stav podle dnešního dne
            </span>
          </div>
        </section>

        <div className="koluj-wide-layout mt-8 md:mt-10">
          <aside className="koluj-wide-sidebar" aria-label="Filtry nabídek">
            <p className="koluj-sidebar-label">Filtry nabídek</p>
            <OfferSearchFilters
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
            }}
            onSearchSubmit={submitSearch}
            offerType={offerType}
            onOfferTypeChange={(value) => {
              setOfferType(value);
              setCategory("all");
              updateUrl({ offerType: value, category: "all" });
            }}
            offerTypeOptions={[
              { value: "all", label: "Vše" },
              ...Object.entries(offerTypeLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            category={category}
            onCategoryChange={(value) => {
              setCategory(value);
              updateUrl({ category: value });
            }}
            categoryOptions={Object.entries(getCategoryOptions(offerType)).map(
              ([value, label]) => ({ value, label })
            )}
            status={status}
            onStatusChange={(value) => {
              setStatus(value);
              updateUrl({ status: value });
            }}
            statusOptions={Object.entries(statusOptions).map(([value, label]) => ({
              value,
              label,
            }))}
            sortBy={sortBy}
            onSortByChange={(value) => {
              setSortBy(value);
              updateUrl({ sortBy: value });
            }}
            sortOptions={[
              { value: "newest", label: "Nejnovější" },
              { value: "oldest", label: "Nejstarší" },
              { value: "az", label: "Název A–Z" },
              { value: "za", label: "Název Z–A" },
            ]}
            onUseLocation={useMyLocation}
            locationActive={Boolean(userLocation)}
          />
          </aside>

          <div className="koluj-main-wide">
            <div className="koluj-wide-filter-card koluj-mobile-only">
              <OfferSearchFilters
                search={search}
                onSearchChange={(value) => { setSearch(value); }}
                onSearchSubmit={submitSearch}
                offerType={offerType}
                onOfferTypeChange={(value) => { setOfferType(value); setCategory("all"); updateUrl({ offerType: value, category: "all" }); }}
                offerTypeOptions={[{ value: "all", label: "Vše" }, ...Object.entries(offerTypeLabels).map(([value, label]) => ({ value, label }))]}
                category={category}
                onCategoryChange={(value) => { setCategory(value); updateUrl({ category: value }); }}
                categoryOptions={Object.entries(getCategoryOptions(offerType)).map(([value, label]) => ({ value, label }))}
                status={status}
                onStatusChange={(value) => { setStatus(value); updateUrl({ status: value }); }}
                statusOptions={Object.entries(statusOptions).map(([value, label]) => ({ value, label }))}
                sortBy={sortBy}
                onSortByChange={(value) => { setSortBy(value); updateUrl({ sortBy: value }); }}
                sortOptions={[{ value: "newest", label: "Nejnovější" }, { value: "oldest", label: "Nejstarší" }, { value: "az", label: "Název A–Z" }, { value: "za", label: "Název Z–A" }]}
                onUseLocation={useMyLocation}
                locationActive={Boolean(userLocation)}
              />
            </div>

        <section className="mt-10 koluj-desktop-mt-0">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="koluj-title">
                {filteredItems.length}{" "}
                {filteredItems.length === 1 ? "nabídku" : "nabídek"}
              </h2>

              <p className="mt-2 text-[var(--koluj-muted)]">
                {userLocation
                  ? "Seřazeno podle vzdálenosti od tvé polohy."
                  : "Vyber si nabídku a otevři detail rezervace."}
              </p>
            </div>

            <div className="flex w-full rounded-2xl border border-[var(--koluj-border)] bg-white p-1 md:w-auto">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold md:flex-none ${
                  viewMode === "list"
                    ? "bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
                    : "text-[var(--koluj-muted)]"
                }`}
              >
                <SlidersHorizontal size={18} />
                Seznam
              </button>

              <button
                type="button"
                onClick={() => setViewMode("map")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold md:flex-none ${
                  viewMode === "map"
                    ? "bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
                    : "text-[var(--koluj-muted)]"
                }`}
              >
                <Map size={18} />
                Mapa
              </button>
            </div>
          </div>

          {viewMode === "map" ? (
            <div className="koluj-card h-[560px] overflow-hidden p-3 md:h-[720px] md:p-4">
              <div className="relative h-full overflow-hidden rounded-[2rem]">
                <OffersMap items={filteredItems} userLocation={userLocation} />

                <button
                  type="button"
                  onClick={useMyLocation}
                  className="absolute bottom-5 right-5 z-[500] flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold shadow-sm"
                >
                  <LocateFixed size={18} />
                  Moje poloha
                </button>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="koluj-card p-10 text-center md:p-12">
              <h3 className="text-2xl font-black">Nic nenalezeno</h3>
              <p className="mt-2 text-[var(--koluj-muted)]">
                Zkus změnit hledání nebo filtr.
              </p>
            </div>
          ) : (
            <>
              <div className="koluj-offer-grid-wide">
                {visibleItems.map((item) => (
                  <OfferCard key={item.id} item={item} />
                ))}
              </div>

              <div ref={loadMoreRef} className="h-8" />

              {visibleItems.length < filteredItems.length ? (
                <p className="mt-3 text-center text-sm font-bold text-[var(--koluj-muted)]">
                  Načítám další nabídky...
                </p>
              ) : (
                <p className="mt-8 text-center text-sm text-[var(--koluj-muted)]">
                  Zobrazeno všech {filteredItems.length} nabídek
                </p>
              )}
            </>
          )}
        </section>
          </div>
        </div>
      </div>
    </main>
  );
}