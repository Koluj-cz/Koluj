"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Boxes,
  Briefcase,
  Drill,
  Leaf,
  LocateFixed,
  PackageOpen,
  Plus,
  Search,
  Sparkles,
  Sprout,
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
  { icon: <PackageOpen size={20} />, label: "Věci", category: "", offerType: "item" },
  { icon: <Briefcase size={20} />, label: "Služby", category: "", offerType: "service" },
  { icon: <Drill size={20} />, label: "Dílna", category: "naradi", offerType: "item" },
  { icon: <Bike size={20} />, label: "Sport", category: "sport", offerType: "item" },
  { icon: <Sprout size={20} />, label: "Zahrada", category: "zahrada", offerType: "service" },
  { icon: <Wrench size={20} />, label: "Řemesla", category: "remesla", offerType: "service" },
  { icon: <Boxes size={20} />, label: "Vše", category: "" },
];

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
  const [selectedCategory, setSelectedCategory] = useState("");
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
    if (selectedCategory) result = result.filter((item) => item.category === selectedCategory);
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
  }, [items, search, selectedOfferType, selectedCategory, userLocation]);

  const displayedItems = filteredItems.slice(0, DISPLAYED_ITEMS_COUNT);

  function selectChip(chip: CategoryDefinition) {
    setSelectedOfferType(chip.offerType || "all");
    setSelectedCategory(chip.category);
  }

  return (
    <main className="koluj-home min-h-screen overflow-hidden text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <header className="koluj-wide-topbar">
          <div className="koluj-wide-topbar-inner">
          <Link href="/" className="koluj-logo" aria-label="Koluj domů">
            <span className="koluj-logo-mark">K</span>
            <span>Koluj</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold text-[var(--koluj-ink)] md:flex">
            <Link href="/offers" className="hover:text-[var(--koluj-green)]">Nabídky</Link>
            <a href="#jak" className="hover:text-[var(--koluj-green)]">Jak to funguje</a>
            <a href="#komunita" className="hover:text-[var(--koluj-green)]">O nás</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <InstallAppButton />
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="koluj-button-secondary hidden px-4 sm:inline-flex">
              {isLoggedIn ? "Můj prostor" : "Přihlásit se"}
            </Link>
            <Link href="/offers/new" className="koluj-button px-4 sm:px-5">
              Přidat nabídku
            </Link>
          </div>
          </div>
        </header>

        <div className="koluj-wide-layout">
          <aside className="koluj-wide-sidebar" aria-label="Rychlé filtry">
            <div className="koluj-sidebar-section">
              <p className="koluj-sidebar-label">Kde hledáte?</p>
              <button type="button" onClick={useMyLocation} className="koluj-button-secondary w-full justify-start px-4" data-active={Boolean(userLocation)}>
                <LocateFixed size={18} /> Okolo mě
              </button>
            </div>

            <div className="koluj-sidebar-section">
              <p className="koluj-sidebar-label">Typ nabídky</p>
              <div className="koluj-sidebar-grid">
                <button type="button" onClick={() => { setSelectedOfferType("item"); setSelectedCategory(""); }} className="koluj-sidebar-tile" data-active={selectedOfferType === "item"}>Věci</button>
                <button type="button" onClick={() => { setSelectedOfferType("service"); setSelectedCategory(""); }} className="koluj-sidebar-tile" data-active={selectedOfferType === "service"}>Služby</button>
              </div>
            </div>

            <div className="koluj-sidebar-section">
              <p className="koluj-sidebar-label">Kategorie</p>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="koluj-select font-bold">
                <option value="">Všechny kategorie</option>
                {categoryChips.filter((chip) => chip.category).map((chip) => <option key={chip.label} value={chip.category}>{chip.label}</option>)}
              </select>
            </div>

            <div className="koluj-sidebar-section">
              <p className="koluj-sidebar-label">Rychlé filtry</p>
              <div className="grid gap-2">
                <span className="koluj-sidebar-chip">Dostupné hned</span>
                <span className="koluj-sidebar-chip">V okolí</span>
                <span className="koluj-sidebar-chip">Věci i služby</span>
              </div>
            </div>

            <div className="koluj-sidebar-section">
              <div className="koluj-sidebar-cta">
                <p className="text-lg font-black text-[var(--koluj-ink)]">Přidejte nabídku</p>
                <p className="mt-2 text-sm font-bold leading-relaxed text-[var(--koluj-muted)]">Máte věc nebo službu, kterou můžete nabídnout ostatním?</p>
                <Link href="/offers/new" className="koluj-button mt-4 min-h-[42px] px-4 text-sm">Přidat nabídku</Link>
              </div>
            </div>
          </aside>

          <div className="koluj-main-wide">
        <section className="koluj-hero-card grid gap-8 p-5 md:p-8 xl:grid-cols-[1fr_0.95fr] xl:p-12">
          <div className="flex flex-col justify-center">
            <h1 className="koluj-heading mt-0">
              Sdílej. Půjčuj. <span className="text-[var(--koluj-green)]">Koluj.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
              Věci i služby, které dávají smysl – pro tebe, pro sousedy i pro planetu.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/offers" className="koluj-button min-h-[52px] px-6">Procházet nabídky <ArrowRight size={18} /></Link>
              <a href="#jak" className="koluj-button-secondary min-h-[52px] px-6">Jak to funguje</a>
            </div>
          </div>

          <HeroIllustration />
        </section>

        <section className="koluj-searchbar mt-5">
          <div className="flex min-h-[46px] items-center gap-3 rounded-[14px] border border-[var(--koluj-border)] bg-white px-4">
            <Search size={20} className="text-[var(--koluj-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              placeholder="Hledat nabídky..."
              className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-slate-400"
            />
          </div>
          <button type="button" onClick={useMyLocation} className="koluj-button-secondary px-4" data-active={Boolean(userLocation)}>
            <LocateFixed size={18} /> Okolo mě
          </button>
          <select value={selectedOfferType} onChange={(e) => { setSelectedOfferType(e.target.value as OfferTypeFilter); setSelectedCategory(""); }} className="koluj-select font-bold">
            <option value="all">Věci i služby</option>
            <option value="item">Věci</option>
            <option value="service">Služby</option>
          </select>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="koluj-select font-bold">
            <option value="">Kategorie</option>
            {categoryChips.filter((chip) => chip.category).map((chip) => <option key={chip.label} value={chip.category}>{chip.label}</option>)}
          </select>
          <button type="button" onClick={submitSearch} className="koluj-button px-6">Hledat</button>
        </section>

        <section className="mt-5 flex gap-3 overflow-x-auto pb-2 koluj-mobile-only">
          {categoryChips
          .filter((chip) => ["Vše", "Věci", "Služby"].includes(chip.label))
          .map((chip) => {
            const active = selectedOfferType === (chip.offerType || "all") && selectedCategory === chip.category;
            return (
              <button key={`${chip.label}-${chip.category}`} type="button" onClick={() => selectChip(chip)} className="koluj-category-chip min-w-[112px]" data-active={active}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--koluj-green-pale)] text-[var(--koluj-green)]">{chip.icon}</span>
                {chip.label}
              </button>
            );
          })}
        </section>

        <section className="mt-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.035em] text-[var(--koluj-ink)]">Právě kolují</h2>
              <p className="mt-2 text-[var(--koluj-muted)]">
                {totalItems > 0 ? `${totalItems.toLocaleString("cs-CZ")} aktivních nabídek na KOLUJ.` : "Vybrané nabídky, které jsou právě dostupné."}
              </p>
            </div>
            <Link href={buildOffersHref()} className="hidden items-center gap-2 font-black text-[var(--koluj-green)] sm:flex">Zobrazit všechny nabídky <ArrowRight size={18} /></Link>
          </div>

          {displayedItems.length > 0 ? (
            <div className="koluj-offer-grid-wide">
              {displayedItems.map((item) => <OfferCard key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="koluj-card p-8 text-[var(--koluj-muted)]">Zatím tu nejsou žádné nabídky.</div>
          )}
        </section>

        <section id="komunita" className="mt-10 grid gap-6 xl:grid-cols-[1fr_.8fr]">
          <div className="koluj-card overflow-hidden p-7 md:p-10">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--koluj-green-pale)] px-4 py-2 text-sm font-black text-[var(--koluj-green)]"><Sparkles size={16} /> Méně kupování. Více sdílení.</p>
            <h2 className="koluj-section-title max-w-lg">Máš něco, co může ještě posloužit?</h2>
            <p className="mt-4 max-w-xl text-lg text-[var(--koluj-muted)]">Přidej nabídku a nech věci nebo služby kolovat mezi lidmi poblíž.</p>
            <Link href="/offers/new" className="koluj-button mt-7 min-h-[52px] px-7">Přidat nabídku <Plus size={18} /></Link>
          </div>

          <div id="jak" className="grid gap-4">
            <InfoCard icon={<Search />} title="Najdi" text="Vyhledej věc nebo službu ve svém okolí." />
            <InfoCard icon={<ArrowRight />} title="Domluv se" text="Otevři detail a domluv termín přímo s poskytovatelem." />
            <InfoCard icon={<Leaf />} title="Nech kolovat" text="Využij, co už existuje, místo zbytečného kupování." />
          </div>
        </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function HeroIllustration() {
  return (
    <div className="koluj-hero-illustration" aria-hidden="true">
      <span className="koluj-plant koluj-plant-left" />
      <span className="koluj-plant koluj-plant-right" />
      <span className="koluj-person koluj-person-left" />
      <span className="koluj-person koluj-person-right" />
      <span className="koluj-box-stack"><span /><span /><span /></span>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="koluj-card flex items-start gap-4 p-5">
      <div className="koluj-icon-bubble shrink-0">{icon}</div>
      <div>
        <p className="text-xl font-black">{title}</p>
        <p className="mt-2 text-sm font-bold leading-relaxed text-[var(--koluj-muted)]">{text}</p>
      </div>
    </div>
  );
}
