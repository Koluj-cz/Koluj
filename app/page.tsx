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
      <div className="koluj-shell-wide relative z-10">
        <header className="koluj-page-header">
          <Link href="/" className="koluj-logo">KOLUJ</Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-[var(--koluj-muted)] lg:flex">
            <Link href="/offers" className="text-[var(--koluj-green)]">Nabídky</Link>
            <a href="#jak" className="hover:text-[var(--koluj-green)]">Jak to funguje</a>
            <a href="#komunita" className="hover:text-[var(--koluj-green)]">Komunita</a>
            <a href="/legal/terms" className="hover:text-[var(--koluj-green)]">O nás</a>
          </nav>

          <div className="flex items-center gap-3">
            <InstallAppButton />
            <Link href="/offers/new" className="hidden rounded-full bg-[var(--koluj-green)] px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5 sm:inline-flex">
              <Plus size={18} /> Přidat nabídku
            </Link>
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="koluj-button px-5 py-3">
              {isLoggedIn ? "Můj prostor" : "Přihlásit se"}
            </Link>
          </div>
        </header>

        <section className="relative grid min-h-[calc(100vh-96px)] items-center gap-8 py-8 lg:grid-cols-[0.78fr_1.22fr] lg:py-10">
          <div className="relative z-20 max-w-2xl">
            <h1 className="koluj-heading mt-6">
              Sdílej.<br />Půjčuj.<br /><span className="text-[var(--koluj-green)]">Koluj.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-2xl">
              Půjč si věci. Objednej služby. Od lidí poblíž.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/offers" className="koluj-button px-6 py-4">Procházet nabídky <ArrowRight size={18} /></Link>
              <a href="#jak" className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border border-[var(--koluj-border)] bg-white/86 px-6 py-4 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:bg-white">
                Jak to funguje
              </a>
            </div>
          </div>

          <HeroGallery items={items} />

          <div className="relative z-30 col-span-full -mt-2 rounded-[28px] border border-[var(--koluj-border)] bg-white p-3 md:p-4 lg:-mt-14">
            <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_150px_170px_170px_150px]">
              <div className="flex min-h-[62px] items-center gap-3 rounded-2xl border border-[var(--koluj-border)] bg-white px-5">
                <Search size={22} className="text-[var(--koluj-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                  placeholder="Hledat nabídku..."
                  className="min-w-0 flex-1 bg-transparent py-4 text-base outline-none placeholder:text-[var(--koluj-muted)] md:text-lg"
                />
                <button type="button" onClick={useMyLocation} className={`hidden items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold sm:flex ${userLocation ? "bg-[var(--koluj-green)] text-white" : "bg-[var(--koluj-bg)] text-[var(--koluj-green)]"}`}>
                  <LocateFixed size={18} /> Okolo mě
                </button>
              </div>
              <select value={selectedOfferType} onChange={(e) => { setSelectedOfferType(e.target.value as OfferTypeFilter); setSelectedCategory(""); }} className="min-h-[62px] rounded-2xl border border-[var(--koluj-border)] bg-white px-4 font-semibold outline-none">
                <option value="all">Vše</option>
                <option value="item">Věci</option>
                <option value="service">Služby</option>
              </select>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="min-h-[62px] rounded-2xl border border-[var(--koluj-border)] bg-white px-4 font-semibold outline-none">
                <option value="">Všechny kategorie</option>
                {categoryChips.filter((chip) => chip.category).map((chip) => <option key={chip.label} value={chip.category}>{chip.label}</option>)}
              </select>
              <select className="min-h-[62px] rounded-2xl border border-[var(--koluj-border)] bg-white px-4 font-semibold outline-none" defaultValue="available">
                <option value="available">Volné</option>
                <option value="all">Všechny stavy</option>
              </select>
              <button type="button" onClick={submitSearch} className="koluj-button px-8 py-4">Hledat</button>
            </div>
          </div>
        </section>

        <section className="relative z-20 -mt-4 flex gap-4 overflow-x-auto pb-2 md:-mt-8">
          {categoryChips.map((chip) => {
            const active = selectedOfferType === (chip.offerType || "all") && selectedCategory === chip.category;
            return (
              <button key={`${chip.label}-${chip.category}`} type="button" onClick={() => selectChip(chip)} className={`flex min-w-[104px] flex-col items-center gap-2 rounded-[28px] px-5 py-4 font-semibold transition ${active ? "bg-[var(--koluj-green)] text-white shadow-[var(--koluj-glow)]" : "bg-white text-[var(--koluj-muted)] hover:bg-white"}`}>
                <span className={`flex h-12 w-12 items-center justify-center rounded-full ${active ? "bg-white/16" : "bg-[var(--koluj-bg)] text-[var(--koluj-green)]"}`}>{chip.icon}</span>
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
                {totalItems > 0 ? `${totalItems.toLocaleString("cs-CZ")} aktivních nabídek na KOLUJ.` : "Vybrané nabídky, které jsou právě dostupné."}
              </p>
            </div>
            <Link href={buildOffersHref()} className="hidden items-center gap-2 font-semibold text-[var(--koluj-green)] sm:flex">Zobrazit všechny nabídky <ArrowRight size={18} /></Link>
          </div>

          {displayedItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
              {displayedItems.map((item) => <OfferCard key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="koluj-card p-8 text-[var(--koluj-muted)]">Zatím tu nejsou žádné nabídky.</div>
          )}
        </section>

        <section id="komunita" className="mt-12 grid gap-6 lg:grid-cols-[1fr_.8fr]">
          <div className="overflow-hidden rounded-[38px] border border-[var(--koluj-border)] bg-white p-7 md:p-10">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--koluj-green-soft)] px-4 py-2 text-sm font-semibold text-[var(--koluj-green)]"><Sparkles size={16} /> Méně kupování. Více sdílení.</p>
            <h2 className="koluj-section-title max-w-lg">Máš něco, co může ještě posloužit?</h2>
            <p className="mt-4 max-w-xl text-lg text-[var(--koluj-muted)]">Přidej nabídku a nech věci nebo služby kolovat mezi lidmi poblíž.</p>
            <Link href="/offers/new" className="koluj-button mt-7 px-7 py-4">Přidat nabídku <Plus size={18} /></Link>
          </div>

          <div id="jak" className="grid gap-4">
            <InfoCard icon={<Search />} title="Najdi" text="Vyhledej věc nebo službu ve svém okolí." />
            <InfoCard icon={<ArrowRight />} title="Domluv se" text="Otevři detail a domluv termín přímo s poskytovatelem." />
            <InfoCard icon={<Leaf />} title="Nech kolovat" text="Využij, co už existuje, místo zbytečného kupování." />
          </div>
        </section>
      </div>
    </main>
  );
}

function HeroGallery({ items }: { items: OfferCardOffer[] }) {
  const photos = items.filter((item) => item.primary_image_url).slice(0, 5);

  if (photos.length === 0) {
    return (
      <div className="koluj-orbit-card relative z-10 hidden items-end p-8 lg:flex">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--koluj-green)]">KOLUJ</p>
          <p className="mt-4 max-w-sm text-4xl font-semibold leading-none tracking-[-0.06em]">Skutečné nabídky od lidí poblíž.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="koluj-photo-grid relative z-10 hidden lg:grid">
      {photos.map((item) => (
        <Link key={item.id} href={`/offers/${item.id}`} className="group relative block">
          <img src={item.primary_image_url!} alt={item.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-5 text-white">
            <p className="text-lg font-semibold tracking-[-0.035em]">{item.title}</p>
            <p className="mt-1 text-sm text-white/82">{item.price_amount ? `${item.price_amount} Kč` : "Dohodou"}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="koluj-card flex items-start gap-4 p-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">{icon}</div>
      <div>
        <p className="text-xl font-semibold">{title}</p>
        <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--koluj-muted)]">{text}</p>
      </div>
    </div>
  );
}
