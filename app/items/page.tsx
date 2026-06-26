"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  LocateFixed,
  Map,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ItemCard, { type ItemCardItem } from "@/app/components/ItemCard";
import AuthHeaderButton from "@/app/components/AuthHeaderButton";
import PageLoader from "@/app/components/PageLoader";
import {
  categories,
  categoryLabels,
  itemStatuses,
  itemStatusLabels,
} from "@/lib/constants";
import { getDistanceKm } from "@/lib/location";

const ItemsMap = dynamic(() => import("@/app/components/ItemsMap"), {
  ssr: false,
});

const categoryOptions = {
  all: "Všechny kategorie",
  ...Object.fromEntries(categories.map(c => [c, categoryLabels[c]])),
};

const statusOptions = {
  available: itemStatusLabels.available,
  reserved: itemStatusLabels.reserved,
  borrowed: itemStatusLabels.borrowed,
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

  const [items, setItems] = useState<ItemCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get("search") || "");
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
  }, [search, category, status, sortBy, userLocation]);

  async function loadItems() {
    const { data, error } = await supabase
      .from("items")
      .select(
        `
        *,
        profiles:profiles!items_owner_id_fkey (
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

    setItems(data || []);
    setLoading(false);
  }

  function updateUrl(next?: {
    search?: string;
    category?: string;
    status?: string;
    sortBy?: string;
  }) {
    const params = new URLSearchParams();

    const nextSearch = next?.search ?? search;
    const nextCategory = next?.category ?? category;
    const nextStatus = next?.status ?? status;
    const nextSortBy = next?.sortBy ?? sortBy;

    if (nextSearch.trim()) params.set("search", nextSearch.trim());
    if (nextCategory !== "all") params.set("category", nextCategory);
    if (nextStatus !== "available") params.set("status", nextStatus);
    if (nextSortBy !== "newest") params.set("sort", nextSortBy);

    router.replace(`/items${params.toString() ? `?${params.toString()}` : ""}`);
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

    if (category !== "all") {
      result = result.filter((item) => item.category === category);
    }

    if (status !== "all") {
      result = result.filter((item) => item.status === status);
    }

    if (userLocation) {
      return result
        .filter((item) => item.pickup_latitude && item.pickup_longitude)
        .sort((a, b) => {
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
  }, [items, search, category, status, sortBy, userLocation]);

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
      <main className="min-h-screen">
        <PageLoader />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="koluj-shell-wide">
        <header className="koluj-page-header">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-[var(--koluj-green)]"
          >
            <ArrowLeft size={20} />
            Zpět na hlavní stránku
          </Link>

          <AuthHeaderButton />
        </header>

        <section className="mt-10 md:mt-12">
          <h1 className="koluj-heading">Všechny věci</h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Procházej věci k půjčení, filtruj podle kategorií, stavu nebo hledej
            konkrétní věc.
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold text-[var(--koluj-green)]">
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">
              {filteredItems.length} výsledků
            </span>
            <span className="rounded-full bg-white px-4 py-2 shadow-sm">
              Výchozí zobrazení: volné věci
            </span>
          </div>
        </section>

        <section className="koluj-card mt-8 p-3 md:mt-10 md:p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_200px]">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--koluj-border)] bg-white px-4">
              <Search size={20} className="text-[var(--koluj-muted)]" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSearch();
                }}
                placeholder="Hledat věc..."
                className="w-full bg-transparent py-4 outline-none"
              />
            </div>

            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                updateUrl({ category: e.target.value });
              }}
              className="koluj-input"
            >
              {Object.entries(categoryOptions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                updateUrl({ status: e.target.value });
              }}
              className="koluj-input"
            >
              {Object.entries(statusOptions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                updateUrl({ sortBy: e.target.value });
              }}
              className="koluj-input"
            >
              <option value="newest">Nejnovější</option>
              <option value="oldest">Nejstarší</option>
              <option value="az">Název A–Z</option>
              <option value="za">Název Z–A</option>
            </select>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={useMyLocation}
              className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--koluj-border)] bg-white px-5 py-3 font-bold text-[var(--koluj-muted)] transition hover:bg-[var(--koluj-bg)]"
            >
              <LocateFixed size={18} />
              Okolo mě
            </button>

            <button
              type="button"
              onClick={submitSearch}
              className="koluj-button px-6 py-3"
            >
              Hledat
            </button>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="koluj-title">
                {filteredItems.length}{" "}
                {filteredItems.length === 1 ? "věc" : "věcí"}
              </h2>

              <p className="mt-2 text-[var(--koluj-muted)]">
                {userLocation
                  ? "Seřazeno podle vzdálenosti od tvé polohy."
                  : "Vyber si věc a otevři detail půjčení."}
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
                <ItemsMap items={filteredItems} userLocation={userLocation} />

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
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>

              <div ref={loadMoreRef} className="h-8" />

              {visibleItems.length < filteredItems.length ? (
                <p className="mt-3 text-center text-sm font-bold text-[var(--koluj-muted)]">
                  Načítám další věci...
                </p>
              ) : (
                <p className="mt-8 text-center text-sm text-[var(--koluj-muted)]">
                  Zobrazeno všech {filteredItems.length} věcí
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}