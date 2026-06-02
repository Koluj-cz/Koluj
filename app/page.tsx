"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  ChevronDown,
  Drill,
  Leaf,
  LocateFixed,
  Map,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const ItemsMap = dynamic(() => import("@/app/components/ItemsMap"), {
  ssr: false,
});

type Item = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  condition: string | null;
  pickup_place: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  price_amount: number | null;
  price_unit: string | null;
  primary_image_url: string | null;
  created_at: string;
  owner_id: string | null;
  status: string | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    is_verified: boolean | null;
  } | null;
};

const categoryLabels: Record<string, string> = {
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
};

const statusClasses: Record<string, string> = {
  available: "koluj-status-available",
  reserved: "koluj-status-reserved",
  borrowed: "koluj-status-borrowed",
};

const conditionLabels: Record<string, string> = {
  new: "Nové",
  like_new: "Jako nové",
  good: "Dobrý stav",
  used: "Běžně používané",
};

function translatePriceUnit(unit: string | null) {
  if (unit === "hour") return "hodinu";
  if (unit === "day") return "den";
  if (unit === "week") return "týden";
  if (unit === "month") return "měsíc";
  if (unit === "piece") return "půjčení";
  return "";
}

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [totalItems, setTotalItems] = useState(0);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [userLocation, setUserLocation] = useState<{
  latitude: number;
  longitude: number;
} | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const { data, count } = await supabase
      .from("items")
      .select(
        `
        *,
        profiles:profiles!items_owner_id_fkey (
          full_name,
          avatar_url,
          is_verified
        )
        `,
        { count: "exact" }
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(4);

    setItems(data || []);
    setTotalItems(count || 0);
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
  let result = items;

  if (search.trim()) {
    const query = search.toLowerCase();

    result = result.filter((item) =>
      `${item.title} ${item.category} ${item.pickup_place}`
        .toLowerCase()
        .includes(query)
    );
  }

  if (userLocation) {
    result = [...result]
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

  return result;
}, [items, search, userLocation]);

  return (
    <main className="min-h-screen">
      <div className="koluj-shell-wide">
        <header className="koluj-page-header">
          <Link
            href="/"
            className="koluj-logo"
          >
            KOLUJ
          </Link>

          <nav className="hidden items-center gap-8 font-bold text-[var(--koluj-muted)] md:flex">
            <a href="#explore">Prozkoumat</a>
            <a href="#mapa">Mapa</a>
            <a href="#how">Jak to funguje</a>
          </nav>

          <Link href="/dashboard" className="koluj-button px-6 py-3">
            Můj prostor
          </Link>
        </header>

        <section className="relative min-h-[560px] overflow-hidden py-6">
          <div className="relative z-20 max-w-3xl">
            <div className="koluj-pill mb-6">
              <Leaf size={16} />
              Půjčuj si chytře, žij udržitelně
            </div>

            <h1 className="koluj-heading">
              Půjčuj si věci od lidí ve svém okolí
            </h1>

            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-[var(--koluj-muted)]">
              Ušetři peníze, místo i planetu. Najdi věci, které zrovna
              potřebuješ, a půjč si je od lidí kolem sebe.
            </p>

            <div className="koluj-searchbar mt-8">
              <div className="flex flex-1 items-center gap-3 px-3">
                <Search size={20} className="text-[var(--koluj-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Co hledáš? Např. stan, vrtačka..."
                  className="w-full bg-transparent py-3 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={useMyLocation}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--koluj-border)] px-5 py-3 font-bold text-[var(--koluj-muted)] transition hover:bg-[var(--koluj-bg)]"
              >
                <LocateFixed size={18} />
                Okolo mě
              </button>

              <button className="koluj-button flex items-center justify-center gap-2 px-6 py-3">
                Hledat
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <CategoryChip icon={<Drill size={16} />} label="Nářadí" />
              <CategoryChip icon={<Bike size={16} />} label="Sport" />
              <CategoryChip icon={<Package size={16} />} label="Elektronika" />
              <CategoryChip icon={<Sparkles size={16} />} label="Volný čas" />

              {showAllCategories && (
                <>
                  <CategoryChip icon={<Package size={16} />} label="Outdoor" />
                  <CategoryChip icon={<Package size={16} />} label="Dům a zahrada" />
                  <CategoryChip icon={<Package size={16} />} label="Foto a video" />
                  <CategoryChip icon={<Package size={16} />} label="Ostatní" />
                </>
              )}

              <button
                type="button"
                onClick={() => setShowAllCategories((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-3 font-bold text-[var(--koluj-muted)]"
              >
                {showAllCategories ? "Zobrazit méně" : "Zobrazit více"}
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute right-0 top-0 z-0 hidden w-[60%] lg:block">
            <Image
              src="/hero-koluj-1.png"
              alt="KOLUJ"
              width={1536}
              height={1024}
              priority
              className="ml-auto h-auto w-full max-w-[1380px] object-contain"
            />
          </div>
        </section>

        <section id="explore" className="mt-4">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="koluj-title">Věci ve tvém okolí</h2>
              <p className="mt-2 text-[var(--koluj-muted)]">
                Celkem {totalItems} aktivních věcí. Na hlavní stránce ukazujeme
                nejnovější 4.
              </p>
            </div>

            <div className="flex rounded-2xl border border-[var(--koluj-border)] bg-white p-1">
              <button
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

          {viewMode === "list" ? (
            <div className="grid items-stretch gap-8 xl:grid-cols-[1fr_780px]"> 
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}

                {filteredItems.length === 0 && (
                  <div className="koluj-card p-10 text-center">
                    <h3 className="text-2xl font-black">Nic nenalezeno</h3>
                    <p className="mt-2 text-[var(--koluj-muted)]">
                      Zkus jiné hledání nebo kategorii.
                    </p>
                  </div>
                )}

              <div className="mt-6">
                <Link
                  href="/veci"
                  className="koluj-button inline-flex items-center gap-2 px-6 py-3"
                >
                  Zobrazit všechny věci
                  <ArrowRight size={18} />
                </Link>
              </div>
              </div>

              <div className="hidden xl:block">
                <div className="koluj-map-panel koluj-map-panel-small">
                  <ItemsMap items={items} userLocation={userLocation} />

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
            </div>
          ) : (
            <section className="koluj-card p-5">
              <div className="koluj-map-panel koluj-map-panel-large">
                <ItemsMap items={items} userLocation={userLocation} />

                <button
                  type="button"
                  onClick={useMyLocation}
                  className="absolute bottom-5 right-5 z-[500] flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold shadow-sm"
                >
                  <LocateFixed size={18} />
                  Moje poloha
                </button>
              </div>
            </section>
          )}
        </section>

        <section id="how" className="mt-16 grid gap-6 md:grid-cols-4">
          <Feature
            icon={<Users size={28} />}
            title="Místní komunita"
            text="Půjčuj si od lidí ve svém okolí."
          />
          <Feature
            icon={<Leaf size={28} />}
            title="Udržitelně"
            text="Dáváme věcem druhou šanci."
          />
          <Feature
            icon={<ShieldCheck size={28} />}
            title="Bezpečně"
            text="Profil a domluva před předáním."
          />
          <Feature
            icon={<MapPin size={28} />}
            title="Blízko"
            text="Najdi věci kolem sebe."
          />
        </section>
      </div>
    </main>
  );
}

function ItemCard({ item }: { item: Item }) {
  const status = item.status || "available";
  const statusLabel = statusLabels[status] || status;
  const statusClass = statusClasses[status] || statusClasses.available;

  const ownerName = item.profiles?.full_name || "Uživatel";
  const ownerInitial = ownerName.charAt(0).toUpperCase();

  return (
    <Link href={`/items/${item.id}`} className="koluj-card koluj-item-row">
      <div className="relative h-36 bg-[var(--koluj-bg)] md:h-full">
        {item.primary_image_url ? (
          <img
            src={item.primary_image_url}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--koluj-muted)]">
            Bez fotky
          </div>
        )}

        {item.price_amount && item.price_unit && (
          <div className="absolute bottom-3 left-3 rounded-xl bg-[var(--koluj-green)] px-3 py-1.5 text-xs font-black text-white">
            {item.price_amount} Kč / {translatePriceUnit(item.price_unit)}
          </div>
        )}
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1fr_210px]">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black">{item.title}</h3>

              <p className="mt-1 text-sm font-bold text-[var(--koluj-green)]">
                {categoryLabels[item.category] || item.category}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--koluj-muted)]">
            <span className="flex items-center gap-1.5">
              <MapPin size={15} />
              {item.pickup_place}
            </span>

            {item.condition && (
              <span className="flex items-center gap-1.5">
                <Star size={15} />
                {conditionLabels[item.condition] || item.condition}
              </span>
            )}

            <span>
              Přidáno {new Date(item.created_at).toLocaleDateString("cs-CZ")}
            </span>
          </div>

          {item.description && (
            <p className="mt-3 line-clamp-2 text-sm text-[var(--koluj-muted)]">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--koluj-border)] pt-4 md:flex-col md:items-end md:border-l md:border-t-0 md:py-1 md:pl-6">
          <span className={`koluj-status-badge hidden md:inline-flex ${statusClass}`}>
            {statusLabel}
          </span>

          <div className="flex items-center gap-3 md:justify-end">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] font-black text-[var(--koluj-green)]">
              {ownerInitial}
            </div>

            <div className="md:text-right">
              <p className="font-black">{ownerName}</p>

              <p className="text-sm font-bold text-[var(--koluj-green)]">
                ★ 5.0
                <span className="ml-1 text-[var(--koluj-muted)]">(12)</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CategoryChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button className="koluj-category-chip">
      {icon}
      {label}
    </button>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="koluj-feature-card">
      <div className="koluj-feature-icon">{icon}</div>
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 text-[var(--koluj-muted)]">{text}</p>
    </div>
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