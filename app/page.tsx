"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Boxes,
  Briefcase,
  Camera,
  Drill,
  Home,
  Leaf,
  LocateFixed,
  PackageOpen,
  Plus,
  Search,
  Sparkles,
  Sprout,
  Trees,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import InstallAppButton from "@/app/components/InstallAppButton";
import { getDistanceKm } from "@/lib/location";

const DISPLAYED_ITEMS_COUNT = 8;
type OfferTypeFilter = "all" | "item" | "service";

type CategoryDefinition = {
  icon: React.ReactNode;
  label: string;
  category: string;
  offerType?: "item" | "service";
};

const categoryChips: CategoryDefinition[] = [
  {
    icon: <PackageOpen size={20} />,
    label: "Věci",
    category: "",
    offerType: "item",
  },
  {
    icon: <Briefcase size={20} />,
    label: "Služby",
    category: "",
    offerType: "service",
  },
  {
    icon: <Drill size={20} />,
    label: "Dílna",
    category: "naradi",
    offerType: "item",
  },
  {
    icon: <Bike size={20} />,
    label: "Sport",
    category: "sport",
    offerType: "item",
  },
  {
    icon: <Trees size={20} />,
    label: "Zahrada",
    category: "zahrada",
    offerType: "service",
  },
  {
    icon: <Wrench size={20} />,
    label: "Řemesla",
    category: "remesla",
    offerType: "service",
  },
  { icon: <Boxes size={20} />, label: "Vše", category: "" },
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

  if (reservationsResult.error)
    console.error("Reservations availability error:", reservationsResult.error);
  if (blocksResult.error)
    console.error("Blocks availability error:", blocksResult.error);

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
  const router = useRouter();
  const [items, setItems] = useState<OfferCardOffer[]>([]);
  const [search, setSearch] = useState("");
  const [selectedOfferType, setSelectedOfferType] =
    useState<OfferTypeFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadItems();
    loadUser();
  }, []);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsLoggedIn(Boolean(user));
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

  function buildOffersHref() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (selectedOfferType !== "all") params.set("type", selectedOfferType);
    if (selectedCategory) params.set("category", selectedCategory);
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
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        toast.success("Poloha nalezena", { id: "location" });
      },
      () => toast.error("Nepodařilo se získat polohu.", { id: "location" }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedOfferType !== "all")
      result = result.filter(
        (item) => getOfferType(item) === selectedOfferType,
      );
    if (selectedCategory)
      result = result.filter((item) => item.category === selectedCategory);
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
        return (
          getDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            a.pickup_latitude!,
            a.pickup_longitude!,
          ) -
          getDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            b.pickup_latitude!,
            b.pickup_longitude!,
          )
        );
      });
    }
    return result;
  }, [items, search, selectedOfferType, selectedCategory, userLocation]);

  const displayedItems = filteredItems.slice(0, DISPLAYED_ITEMS_COUNT);

  function selectChip(chip: CategoryDefinition) {
    setSelectedOfferType(chip.offerType || "all");
    setSelectedCategory(chip.category);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f3e8] text-[var(--koluj-text)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.95),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(214,227,182,0.72),transparent_32%),linear-gradient(180deg,#fbfaf4_0%,#f7f3e8_74%,#f7f3e8_100%)]" />
      <div className="pointer-events-none absolute left-[-12%] top-[360px] h-[420px] w-[420px] rounded-full bg-white/60 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10%] top-[520px] h-[520px] w-[520px] rounded-full bg-[rgba(107,127,50,0.10)] blur-3xl" />

      <div className="koluj-shell-wide relative z-10">
        <header className="koluj-page-header">
          <Link href="/" className="koluj-logo">
            KOLUJ
          </Link>
          <div className="hidden items-center gap-8 text-sm font-black text-[var(--koluj-muted)] lg:flex">
            <Link href="/offers" className="hover:text-[var(--koluj-green)]">
              Nabídky
            </Link>
            <a href="#jak" className="hover:text-[var(--koluj-green)]">
              Jak to funguje
            </a>
            <a href="#komunita" className="hover:text-[var(--koluj-green)]">
              Komunita
            </a>
          </div>
          <div className="flex items-center gap-3">
            <InstallAppButton />
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="koluj-button px-5 py-3"
            >
              {isLoggedIn ? "Můj prostor" : "Přihlásit se"}
            </Link>
          </div>
        </header>

        <section className="relative mt-8 overflow-hidden rounded-[44px] border border-white/80 bg-white/70 p-6 shadow-[0_28px_90px_rgba(40,42,30,0.10)] backdrop-blur-xl md:p-10 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <div className="relative z-10 flex flex-col justify-center py-4 md:py-10">
            <p className="koluj-pill w-fit">Věci i služby od lidí poblíž</p>
            <h1 className="koluj-heading mt-6">
              Sdílej.
              <br />
              Půjčuj.
              <br />
              <span className="text-[var(--koluj-green)]">Koluj.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-2xl">
              Věci i služby, které dávají smysl – pro tebe, pro sousedy i pro
              planetu.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/offers" className="koluj-button px-6 py-4">
                Procházet nabídky <ArrowRight size={18} />
              </Link>
              <Link
                href="/offers/new"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white/90 px-6 py-4 font-black shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
              >
                Přidat nabídku <Plus size={18} />
              </Link>
            </div>
          </div>

          <HeroOrbit />
        </section>

        <section className="relative z-20 mx-auto -mt-8 max-w-6xl rounded-[34px] border border-white/80 bg-white/86 p-3 shadow-[0_18px_55px_rgba(40,42,30,0.13)] backdrop-blur-xl md:p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="flex min-h-[62px] flex-1 items-center gap-3 rounded-full border border-black/[0.08] bg-white px-5">
              <Search size={22} className="text-[var(--koluj-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                placeholder="Hledat nabídku..."
                className="min-w-0 flex-1 bg-transparent py-4 text-lg outline-none placeholder:text-[var(--koluj-muted)]"
              />
              <button
                type="button"
                onClick={useMyLocation}
                className={`hidden items-center gap-2 rounded-full px-4 py-3 font-black sm:flex ${userLocation ? "bg-[var(--koluj-green)] text-white" : "bg-[var(--koluj-bg)] text-[var(--koluj-green)]"}`}
              >
                <LocateFixed size={18} /> Okolo mě
              </button>
            </div>
            <button
              type="button"
              onClick={submitSearch}
              className="koluj-button px-8 py-4"
            >
              Hledat
            </button>
          </div>
        </section>

        <section className="mt-8 flex gap-4 overflow-x-auto pb-2">
          {categoryChips.map((chip) => {
            const active =
              selectedOfferType === (chip.offerType || "all") &&
              selectedCategory === chip.category;
            return (
              <button
                key={`${chip.label}-${chip.category}`}
                type="button"
                onClick={() => selectChip(chip)}
                className={`flex min-w-[96px] flex-col items-center gap-2 rounded-[26px] px-5 py-4 font-black transition ${active ? "bg-[var(--koluj-green)] text-white shadow-[var(--koluj-glow)]" : "bg-white/72 text-[var(--koluj-muted)] hover:bg-white"}`}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${active ? "bg-white/16" : "bg-[var(--koluj-bg)] text-[var(--koluj-green)]"}`}
                >
                  {chip.icon}
                </span>
                {chip.label}
              </button>
            );
          })}
        </section>

        <section className="mt-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="koluj-section-title">Právě kolují ✨</h2>
              <p className="mt-2 text-[var(--koluj-muted)]">
                Vybrané nabídky, které se teď hodí.
              </p>
            </div>
            <Link
              href={buildOffersHref()}
              className="hidden items-center gap-2 font-black text-[var(--koluj-green)] sm:flex"
            >
              Zobrazit vše <ArrowRight size={18} />
            </Link>
          </div>

          {displayedItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {displayedItems.map((item) => (
                <OfferCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="koluj-card p-8 text-[var(--koluj-muted)]">
              Zatím tu nejsou žádné nabídky.
            </div>
          )}
        </section>

        <section
          id="komunita"
          className="mt-12 overflow-hidden rounded-[38px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(226,234,204,0.64))] p-7 shadow-[0_20px_60px_rgba(40,42,30,0.10)] md:flex md:items-center md:justify-between md:p-10"
        >
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-black text-[var(--koluj-green)]">
              <Sparkles size={16} /> Méně kupování. Více sdílení.
            </p>
            <h2 className="koluj-section-title max-w-lg">
              Máš něco, co může ještě posloužit?
            </h2>
            <p className="mt-4 max-w-xl text-lg text-[var(--koluj-muted)]">
              Přidej nabídku a nech věci nebo služby kolovat mezi lidmi poblíž.
            </p>
          </div>
          <Link
            href="/offers/new"
            className="koluj-button mt-6 px-7 py-4 md:mt-0"
          >
            Přidat nabídku <Plus size={18} />
          </Link>
        </section>

        <section id="jak" className="mt-8 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Search />}
            title="Najdi"
            text="Vyhledej věc nebo službu ve svém okolí."
          />
          <InfoCard
            icon={<ArrowRight />}
            title="Domluv se"
            text="Otevři detail a domluv termín přímo s poskytovatelem."
          />
          <InfoCard
            icon={<Leaf />}
            title="Nech kolovat"
            text="Využij, co už existuje, místo zbytečného kupování."
          />
        </section>
      </div>
    </main>
  );
}

function HeroOrbit() {
  return (
    <div className="relative mt-10 min-h-[340px] lg:mt-0 lg:min-h-[520px]">
      <div className="absolute inset-0 rounded-[54px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(246,242,229,0.72))] shadow-[0_38px_90px_rgba(60,58,42,0.14)]" />
      <div className="absolute left-1/2 top-1/2 h-[56%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-[999px] border border-[rgba(107,127,50,0.18)] bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.92),rgba(222,231,197,0.34)_64%,rgba(255,255,255,0.06)_100%)] shadow-[inset_0_0_70px_rgba(255,255,255,0.88),0_24px_80px_rgba(107,127,50,0.12)] rotate-[-10deg]" />
      <div className="absolute left-1/2 top-1/2 h-[62%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-[999px] border border-dashed border-[rgba(107,127,50,0.24)] rotate-[-10deg]" />

      <OrbitObject
        className="left-[11%] top-[18%]"
        delay="0s"
        title="Vrtačka"
        icon={<Drill size={34} />}
      />
      <OrbitObject
        className="left-[42%] top-[10%]"
        delay=".7s"
        title="Židle"
        icon={<Home size={34} />}
      />
      <OrbitObject
        className="right-[15%] top-[18%]"
        delay="1.1s"
        title="Zahrada"
        icon={<Sprout size={34} />}
      />
      <OrbitObject
        className="bottom-[23%] left-[41%]"
        delay=".35s"
        title="Foto"
        icon={<Camera size={34} />}
      />
      <OrbitObject
        className="bottom-[18%] right-[8%]"
        delay="1.45s"
        title="Koloběžka"
        icon={<Bike size={38} />}
        large
      />

      <div className="absolute bottom-[25%] left-[18%] flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-black shadow-lg">
        D
      </div>
      <div className="absolute right-[8%] top-[8%] flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-black shadow-lg">
        K
      </div>
    </div>
  );
}

function OrbitObject({
  icon,
  title,
  className,
  delay,
  large = false,
}: {
  icon: React.ReactNode;
  title: string;
  className: string;
  delay: string;
  large?: boolean;
}) {
  return (
    <div
      className={`absolute flex ${large ? "h-24 w-24" : "h-20 w-20"} items-center justify-center rounded-[28px] bg-white/92 text-[var(--koluj-green)] shadow-[0_18px_42px_rgba(40,42,30,0.16)] ring-1 ring-black/[0.04] ${className}`}
      style={{ animation: `kolujSoftFloat 5.8s ease-in-out ${delay} infinite` }}
      title={title}
    >
      {icon}
    </div>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="koluj-card flex items-start gap-4 p-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
        {icon}
      </div>
      <div>
        <p className="text-xl font-black">{title}</p>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[var(--koluj-muted)]">
          {text}
        </p>
      </div>
      <style jsx global>{`
        @keyframes kolujSoftFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(-2deg);
          }
          50% {
            transform: translate3d(0, -14px, 0) rotate(3deg);
          }
        }
      `}</style>
    </div>
  );
}
