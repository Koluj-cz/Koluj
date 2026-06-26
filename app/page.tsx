"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  Drill,
  Bike,
  Smartphone,
  Trees,
  Camera,
  Boxes,
  LocateFixed,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import ItemCard, { type ItemCardItem } from "@/app/components/ItemCard";
import toast from "react-hot-toast";
import InstallAppButton from "@/app/components/InstallAppButton";
import { getDistanceKm } from "@/lib/location";

const ItemsMap = dynamic(() => import("@/app/components/ItemsMap"), {
  ssr: false,
});

const DISPLAYED_ITEMS_COUNT = 10;
const ROTATION_INTERVAL_MS = 3000;

export default function HomePage() {
  const [showMap, setShowMap] = useState(false);
  const [items, setItems] = useState<ItemCardItem[]>([]);
  const [displayedItems, setDisplayedItems] = useState<ItemCardItem[]>([]);
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  function submitSearch() {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    router.push(`/items?${params.toString()}`);
  }

  useEffect(() => {
    loadItems();
    loadUser();

    const media = window.matchMedia("(min-width: 1024px)");
    setShowMap(media.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setShowMap(event.matches);
    };

    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, []);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsLoggedIn(!!user);
  }

  async function loadItems() {
    const { data, count } = await supabase
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
        `,
        { count: "exact" }
      )
      .eq("is_active", true)
      .is("deleted_at", null)
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(40);

    setItems(data || []);
    setTotalItems(count || 0);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Tvoje zařízení nepodporuje zjištění polohy.");
      return;
    }

    toast.loading("Zjišťuji polohu...", {
      id: "location",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        toast.success("Poloha nalezena", {
          id: "location",
        });
      },
      (error) => {
        console.error("Geolocation error:", error);

        let message = "Nepodařilo se získat polohu.";

        if (error.code === error.PERMISSION_DENIED) {
          message = "Poloha není povolená. Povol ji v nastavení prohlížeče.";
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Poloha není momentálně dostupná.";
        }

        if (error.code === error.TIMEOUT) {
          message =
            "Nepodařilo se získat polohu. Zkontroluj, zda má prohlížeč povolenou polohu a přesnou polohu.";
        }

        toast.error(message, {
          id: "location",
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000,
      }
    );
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

  useEffect(() => {
    setDisplayedItems(filteredItems.slice(0, DISPLAYED_ITEMS_COUNT));
  }, [filteredItems]);

  useEffect(() => {
    if (filteredItems.length <= DISPLAYED_ITEMS_COUNT) return;

    const interval = setInterval(() => {
      setDisplayedItems((currentItems) => {
        if (currentItems.length === 0) {
          return filteredItems.slice(0, DISPLAYED_ITEMS_COUNT);
        }

        const currentIds = new Set(currentItems.map((item) => item.id));
        const candidates = filteredItems.filter(
          (item) => !currentIds.has(item.id)
        );

        if (candidates.length === 0) {
          return filteredItems.slice(0, DISPLAYED_ITEMS_COUNT);
        }

        const replacement =
          candidates[Math.floor(Math.random() * candidates.length)];

        const replaceIndex = Math.floor(Math.random() * currentItems.length);

        const nextItems = [...currentItems];
        nextItems[replaceIndex] = replacement;

        return nextItems;
      });
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [filteredItems]);

  return (
    <main className="min-h-screen">
      <div className="koluj-shell-wide">
        <header className="koluj-page-header">
          <Link href="/" className="koluj-logo">
            KOLUJ
          </Link>

          <div className="flex items-center gap-3">
            <InstallAppButton />
            {isLoggedIn ? (
              <Link href="/dashboard" className="koluj-button px-5 py-3 md:px-6">
                Můj prostor
              </Link>
            ) : (
              <Link href="/login" className="koluj-button px-5 py-3 md:px-6">
                Přihlášení / registrace
              </Link>
            )}
          </div>
        </header>

        <section className="grid items-start gap-6 py-4 md:py-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col lg:h-[430px]">
            <h1 className="koluj-heading">
              <span className="md:hidden">Půjč si věc poblíž</span>
              <span className="hidden md:block">
                Půjčuj si věci od lidí ve svém okolí
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
              Ušetři peníze, místo i planetu. Najdi věci, které zrovna
              potřebuješ, a půjč si je od lidí kolem sebe.
            </p>

            <div className="mt-5 hidden flex-wrap gap-2 text-sm font-bold text-[var(--koluj-green)] md:flex">
              <span className="rounded-full bg-white px-4 py-2 shadow-sm">
                {totalItems} věcí k půjčení
              </span>
              <span className="rounded-full bg-white px-4 py-2 shadow-sm">
                Půjčení ve tvém okolí
              </span>
              <span className="rounded-full bg-white px-4 py-2 shadow-sm">
                Domluva přímo s majitelem
              </span>
            </div>

            <div className="mt-6 flex max-w-2xl flex-col gap-3 rounded-3xl border border-[var(--koluj-border)] bg-white p-3 shadow-sm md:mt-auto md:flex-row">
              <div className="flex flex-1 items-center gap-3 px-3">
                <Search size={20} className="text-[var(--koluj-muted)]" />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitSearch();
                  }}
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
                Moje poloha
              </button>

              <button
                type="button"
                onClick={submitSearch}
                className="koluj-button px-6 py-3"
              >
                Hledat
              </button>
            </div>
          </div>

          {showMap && (
            <div className="relative h-[430px] overflow-hidden rounded-[2rem] border border-[var(--koluj-border)] bg-white shadow-sm">
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
          )}
        </section>

        <section className="koluj-categories-mobile mt-6 lg:grid lg:grid-cols-8 lg:gap-2">
          <CategoryChip label="Vše" category="" />
          <CategoryChip icon={<Drill size={16} />} label="Nářadí" category="naradi" />
          <CategoryChip icon={<Bike size={16} />} label="Sport" category="sport" />
          <CategoryChip icon={<Smartphone size={16} />} label="Elektronika" category="elektronika" />
          <CategoryChip icon={<Sparkles size={16} />} label="Outdoor" category="outdoor" />
          <CategoryChip icon={<Trees size={16} />} label="Dům a zahrada" category="dum_zahrada" />
          <CategoryChip icon={<Camera size={16} />} label="Foto a video" category="foto_video" />
          <CategoryChip icon={<Boxes size={16} />} label="Ostatní" category="ostatni" />
        </section>

        <section id="explore" className="mt-12 md:mt-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="koluj-title">Věci ve tvém okolí</h2>
              <p className="mt-2 text-[var(--koluj-muted)]">
                Celkem {totalItems} aktivních věcí.
              </p>
            </div>

            <Link
              href="/items"
              className="hidden items-center gap-2 font-black text-[var(--koluj-green)] md:flex"
            >
              Zobrazit všechny
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-5">
            {displayedItems.map((item) => (
              <div key={item.id} className="transition duration-300">
                <ItemCard item={item} />
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center md:mt-10">
            <Link
              href="/items"
              className="koluj-button inline-flex items-center gap-2 px-8 py-4"
            >
              Zobrazit všechny věci
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section id="how" className="mt-16">
          <div className="mb-6">
            <h2 className="koluj-title">Jak to funguje</h2>
            <p className="mt-2 text-[var(--koluj-muted)]">
              Vyber věc, domluv termín a půjč si ji od člověka poblíž.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            <Feature
              icon={<Search size={28} />}
              title="1. Najdi věc"
              text="Vyhledej, co zrovna potřebuješ."
            />
            <Feature
              icon={<Users size={28} />}
              title="2. Domluv termín"
              text="Napiš majiteli a potvrďte si předání."
            />
            <Feature
              icon={<MapPin size={28} />}
              title="3. Půjč si"
              text="Vyzvedni věc ve svém okolí."
            />
            <Feature
              icon={<ShieldCheck size={28} />}
              title="4. Vrať a ohodnoť"
              text="Vrať věc a pomoz budovat důvěru."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function CategoryChip({
  icon,
  label,
  category,
}: {
  icon?: React.ReactNode;
  label: string;
  category: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() =>
        router.push(category ? `/items?category=${category}` : "/items")
      }
      className="koluj-category-chip"
    >
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