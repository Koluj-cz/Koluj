"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, LocateFixed, Map, Search, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ItemCard, { type ItemCardItem } from "@/app/components/ItemCard";

const ItemsMap = dynamic(() => import("@/app/components/ItemsMap"), {
  ssr: false,
});

const categoryLabels: Record<string, string> = {
  all: "Všechny kategorie",
  naradi: "Nářadí",
  elektronika: "Elektronika",
  sport: "Sport",
  outdoor: "Outdoor",
  dum_zahrada: "Dům a zahrada",
  auto_moto: "Auto/Moto",
  foto_video: "Foto a video",
  party_akce: "Party a akce",
  ostatni: "Ostatní",
};

const statusLabels: Record<string, string> = {
  available: "Volné",
  reserved: "Rezervované",
  borrowed: "Půjčené",
  all: "Všechny stavy",
};

export default function VeciPage() {
  return (
    <Suspense fallback={<div className="koluj-shell">Načítám...</div>}>
      <VeciPageContent />
    </Suspense>
  );
}

function VeciPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<ItemCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [status, setStatus] = useState(searchParams.get("status") || "available");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [visibleCount, setVisibleCount] = useState(12);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    setVisibleCount(12);
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
  }) {
    const params = new URLSearchParams();

    const nextSearch = next?.search ?? search;
    const nextCategory = next?.category ?? category;
    const nextStatus = next?.status ?? status;

    if (nextSearch.trim()) params.set("search", nextSearch.trim());
    if (nextCategory !== "all") params.set("category", nextCategory);
    if (nextStatus !== "available") params.set("status", nextStatus);

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
        `${item.title} ${item.category} ${item.pickup_place} ${item.description || ""}`
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
      result = result
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

      return result;
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

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="koluj-shell">Načítám...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="koluj-shell-wide">
        <header className="koluj-page-header">
          <Link href="/" className="flex items-center gap-2 font-bold text-[var(--koluj-green)]">
            <ArrowLeft size={20} />
            Zpět na hlavní stránku
          </Link>

          <Link href="/dashboard" className="koluj-button px-6 py-3">
            Můj prostor
          </Link>
        </header>

        <section className="mt-12">
          <h1 className="koluj-heading">Všechny věci</h1>

          <p className="mt-6 max-w-2xl text-xl leading-relaxed text-[var(--koluj-muted)]">
            Procházej věci k půjčení, filtruj podle kategorií, stavu nebo hledej konkrétní věc.
          </p>
        </section>

        <section className="koluj-card mt-10 p-4">
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
              {Object.entries(categoryLabels).map(([value, label]) => (
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
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="koluj-input"
            >
              <option value="newest">Nejnovější</option>
              <option value="oldest">Nejstarší</option>
              <option value="az">Název A–Z</option>
              <option value="za">Název Z–A</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={useMyLocation}
              className="flex items-center gap-2 rounded-2xl border border-[var(--koluj-border)] bg-white px-5 py-3 font-bold text-[var(--koluj-muted)]"
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
                Výchozí zobrazení ukazuje volné věci.
              </p>
            </div>

            <div className="flex rounded-2xl border border-[var(--koluj-border)] bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 font-bold ${
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
                className={`flex items-center gap-2 rounded-xl px-5 py-3 font-bold ${
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
            <div className="koluj-card h-[720px] overflow-hidden p-4">
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
            <div className="koluj-card p-12 text-center">
              <h3 className="text-2xl font-black">Nic nenalezeno</h3>
              <p className="mt-2 text-[var(--koluj-muted)]">
                Zkus změnit hledání nebo filtr.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {visibleItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>

              {visibleCount < filteredItems.length && (
                <div className="mt-10 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 12)}
                    className="rounded-2xl border border-[var(--koluj-border)] bg-white px-8 py-4 font-bold transition hover:bg-[var(--koluj-bg)]"
                  >
                    Načíst další
                  </button>

                  <p className="mt-3 text-sm text-[var(--koluj-muted)]">
                    Zobrazeno {visibleItems.length} z {filteredItems.length} věcí
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}