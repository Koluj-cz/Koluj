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
  Wrench,
  GraduationCap,
  Laptop,
  Home,
  Truck,
  Baby,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import toast from "react-hot-toast";
import InstallAppButton from "@/app/components/InstallAppButton";
import { getDistanceKm } from "@/lib/location";

const OffersMap = dynamic(() => import("@/app/components/OffersMap"), {
  ssr: false,
});

const DISPLAYED_ITEMS_COUNT = 10;
const ROTATION_INTERVAL_MS = 3000;

type OfferTypeFilter = "all" | "item" | "service";

type CategoryDefinition = {
  icon?: React.ReactNode;
  label: string;
  category: string;
  offerType?: "item" | "service";
};

const itemCategoryChips: CategoryDefinition[] = [
  {
    icon: <Drill size={16} />,
    label: "Nářadí",
    category: "naradi",
    offerType: "item",
  },
  {
    icon: <Bike size={16} />,
    label: "Sport",
    category: "sport",
    offerType: "item",
  },
  {
    icon: <Smartphone size={16} />,
    label: "Elektronika",
    category: "elektronika",
    offerType: "item",
  },
  {
    icon: <Sparkles size={16} />,
    label: "Outdoor",
    category: "outdoor",
    offerType: "item",
  },
  {
    icon: <Trees size={16} />,
    label: "Dům a zahrada",
    category: "dum_zahrada",
    offerType: "item",
  },
  {
    icon: <Camera size={16} />,
    label: "Foto a video",
    category: "foto_video",
    offerType: "item",
  },
  {
    icon: <Boxes size={16} />,
    label: "Ostatní",
    category: "ostatni",
    offerType: "item",
  },
];

const serviceCategoryChips: CategoryDefinition[] = [
  {
    icon: <Wrench size={16} />,
    label: "Řemesla",
    category: "remesla",
    offerType: "service",
  },
  {
    icon: <Home size={16} />,
    label: "Domácnost",
    category: "domacnost",
    offerType: "service",
  },
  {
    icon: <Trees size={16} />,
    label: "Zahrada",
    category: "zahrada",
    offerType: "service",
  },
  {
    icon: <Truck size={16} />,
    label: "Stěhování",
    category: "stehovani",
    offerType: "service",
  },
  {
    icon: <GraduationCap size={16} />,
    label: "Doučování",
    category: "doucovani",
    offerType: "service",
  },
  {
    icon: <Laptop size={16} />,
    label: "IT",
    category: "it",
    offerType: "service",
  },
  {
    icon: <Baby size={16} />,
    label: "Hlídání",
    category: "hlidani",
    offerType: "service",
  },
  {
    icon: <Boxes size={16} />,
    label: "Ostatní služby",
    category: "ostatni_sluzby",
    offerType: "service",
  },
];

const mixedCategoryChips: CategoryDefinition[] = [
  itemCategoryChips[0],
  itemCategoryChips[1],
  itemCategoryChips[3],
  itemCategoryChips[4],
  serviceCategoryChips[0],
  serviceCategoryChips[1],
  serviceCategoryChips[2],
  serviceCategoryChips[3],
];

function getOfferType(item: OfferCardOffer) {
  return ((item as OfferCardOffer & { offer_type?: string }).offer_type ||
    "item") as "item" | "service";
}

async function attachTodayAvailability<T extends { id: string }>(items: T[]) {
  if (items.length === 0)
    return items as (T & { is_reserved_today: boolean })[];

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
  const [showMap, setShowMap] = useState(false);
  const [items, setItems] = useState<OfferCardOffer[]>([]);
  const [displayedItems, setDisplayedItems] = useState<OfferCardOffer[]>([]);
  const [search, setSearch] = useState("");
  const [selectedOfferType, setSelectedOfferType] =
    useState<OfferTypeFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  function buildOffersHref() {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (selectedOfferType !== "all") {
      params.set("type", selectedOfferType);
    }

    if (selectedCategory) {
      params.set("category", selectedCategory);
    }

    return `/offers${params.toString() ? `?${params.toString()}` : ""}`;
  }

  function submitSearch() {
    router.push(buildOffersHref());
  }

  function selectOfferType(type: OfferTypeFilter) {
    setSelectedOfferType(type);
    setSelectedCategory("");
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
      },
    );
  }

  const filteredItems = useMemo(() => {
    let result = items;

    if (selectedOfferType !== "all") {
      result = result.filter(
        (item) => getOfferType(item) === selectedOfferType,
      );
    }

    if (selectedCategory) {
      result = result.filter((item) => item.category === selectedCategory);
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

        const distanceA = getDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          a.pickup_latitude!,
          a.pickup_longitude!,
        );

        const distanceB = getDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          b.pickup_latitude!,
          b.pickup_longitude!,
        );

        return distanceA - distanceB;
      });
    }

    return result;
  }, [items, search, selectedOfferType, selectedCategory, userLocation]);

  const visibleCategoryChips =
    selectedOfferType === "item"
      ? itemCategoryChips
      : selectedOfferType === "service"
        ? serviceCategoryChips
        : [...itemCategoryChips, ...serviceCategoryChips];

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
          (item) => !currentIds.has(item.id),
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
              <Link
                href="/dashboard"
                className="koluj-button px-5 py-3 md:px-6"
              >
                Můj prostor
              </Link>
            ) : (
              <Link href="/login" className="koluj-button px-5 py-3 md:px-6">
                Přihlášení / registrace
              </Link>
            )}
          </div>
        </header>

        <section className="grid items-start gap-8 pt-6 pb-0 md:py-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col lg:h-[430px]">
            <h1 className="koluj-heading">Půjč si věci. Objednej si služby.</h1>

            <p className="mt-3 max-w-xl text-base leading-snug text-[var(--koluj-muted)] md:text-xl md:leading-relaxed">
              Vše jednoduše od lidí ve tvém okolí.
            </p>

            <div className="mt-5 hidden flex-wrap gap-2 text-sm font-bold text-[var(--koluj-green)] md:flex">
              <span className="rounded-full bg-white px-4 py-2 shadow-sm">
                {totalItems} aktivních nabídek
              </span>
              <span className="rounded-full bg-white px-4 py-2 shadow-sm">
                Věci i služby
              </span>
              <span className="rounded-full bg-white px-4 py-2 shadow-sm">
                Bez prostředníků
              </span>
            </div>

            <div className="mt-8 lg:mt-auto flex max-w-2xl items-center gap-2 rounded-[1.75rem] border border-[var(--koluj-border)] bg-white p-2 shadow-sm">
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                <Search
                  size={20}
                  className="shrink-0 text-[var(--koluj-muted)]"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitSearch();
                  }}
                  placeholder="Co hledáš?"
                  className="w-full bg-transparent py-3 text-base font-bold outline-none placeholder:font-medium"
                />
              </div>

              <button
                type="button"
                onClick={useMyLocation}
                aria-label="Moje poloha"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
              >
                <LocateFixed size={20} />
              </button>

              <button
                type="button"
                onClick={submitSearch}
                aria-label="Hledat"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--koluj-green)] text-white"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>

          {showMap && (
            <div className="relative h-[430px] overflow-hidden rounded-[2rem] border border-[var(--koluj-border)] bg-white shadow-sm">
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
          )}
        </section>

        <section className="mt-4 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 text-sm font-black md:flex-wrap md:overflow-visible">
            <OfferTypeButton
              active={selectedOfferType === "all"}
              onClick={() => selectOfferType("all")}
              label="Vše"
            />
            <OfferTypeButton
              active={selectedOfferType === "item"}
              onClick={() => selectOfferType("item")}
              label="Věci"
            />
            <OfferTypeButton
              active={selectedOfferType === "service"}
              onClick={() => selectOfferType("service")}
              label="Služby"
            />
          </div>

          <div className="koluj-categories-mobile lg:grid lg:grid-cols-8 lg:gap-2">
            <CategoryChip
              label="Všechny kategorie"
              active={!selectedCategory}
              onClick={() => setSelectedCategory("")}
            />
            {visibleCategoryChips.map((chip) => (
              <CategoryChip
                key={`${chip.offerType || "all"}-${chip.category}`}
                icon={chip.icon}
                label={chip.label}
                active={selectedCategory === chip.category}
                onClick={() => {
                  setSelectedCategory(chip.category);

                  if (chip.offerType && selectedOfferType === "all") {
                    setSelectedOfferType(chip.offerType);
                  }
                }}
              />
            ))}
          </div>
        </section>

        <section id="explore" className="mt-5 md:mt-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="koluj-title">Nabídky ve tvém okolí</h2>
              <p className="mt-2 text-[var(--koluj-muted)]">
                {filteredItems.length === totalItems
                  ? `Celkem ${totalItems} aktivních nabídek.`
                  : `Zobrazeno ${filteredItems.length} z ${totalItems} aktivních nabídek.`}
              </p>
            </div>

            <Link
              href={buildOffersHref()}
              className="hidden items-center gap-2 font-black text-[var(--koluj-green)] md:flex"
            >
              Zobrazit všechny
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {displayedItems.map((item) => (
              <div key={item.id} className="transition duration-300">
                <OfferCard item={item} />
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center md:mt-10">
            <Link
              href={buildOffersHref()}
              className="koluj-button inline-flex items-center gap-2 px-8 py-4"
            >
              Zobrazit všechny nabídky
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section id="how" className="mt-16">
          <div className="mb-6">
            <h2 className="koluj-title">Jak to funguje</h2>
            <p className="mt-2 text-[var(--koluj-muted)]">
              Najdi věc nebo službu, domluv se přímo s poskytovatelem a rezervuj
              si termín.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            <Feature
              icon={<Search size={28} />}
              title="1. Najdi nabídku"
              text="Vyhledej, co zrovna potřebuješ."
            />
            <Feature
              icon={<Users size={28} />}
              title="2. Domluv termín"
              text="Napiš poskytovateli a potvrďte si vhodný čas."
            />
            <Feature
              icon={<MapPin size={28} />}
              title="3. Rezervuj"
              text="Vyzvedni věc nebo využij službu."
            />
            <Feature
              icon={<ShieldCheck size={28} />}
              title="4. Ohodnoť zkušenost"
              text="Po skončení napiš hodnocení a pomoz budovat důvěru."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function OfferTypeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-2xl border px-5 py-3 transition ${
        active
          ? "border-[var(--koluj-green)] bg-[var(--koluj-green)] text-white"
          : "border-[var(--koluj-border)] bg-white text-[var(--koluj-text)] hover:bg-[var(--koluj-bg)]"
      }`}
    >
      {label}
    </button>
  );
}

function CategoryChip({
  icon,
  label,
  active,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`koluj-category-chip ${
        active
          ? "border-[var(--koluj-green)] bg-[var(--koluj-green)] text-white"
          : ""
      }`}
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
