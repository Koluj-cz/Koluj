"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  CalendarDays,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import PageLoader from "@/app/components/PageLoader";
import OfferSearchFilters from "@/app/components/OfferSearchFilters";
import BackLink from "@/app/components/BackLink";
import {
  categories,
  categoryLabels,
  serviceCategories,
  serviceCategoryLabels,
  offerTypeLabels,
} from "@/lib/constants";



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


type Offer = OfferCardOffer & {
  is_active: boolean;
  deleted_at: string | null;
  borrow_count: number | null;
};

export default function MyOffersPage() {
  const [items, setItems] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [offerType, setOfferType] = useState("all");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(8);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadOffers();
  }, []);

  useEffect(() => {
    setVisibleCount(8);
  }, [searchQuery, offerType, category, statusFilter, sortBy]);

  async function loadOffers() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("offers")
      .select(`
        *,
        bookings:bookings!bookings_offer_id_fkey (
          id,
          owner_earnings
        )
      `)
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const itemsWithAvailability = await attachTodayAvailability(
      ((data || []) as Offer[])
    );

    setItems(itemsWithAvailability);
    setLoading(false);
  }

  async function toggleVisibility(item: Offer) {
    const nextValue = !item.is_active;

    const { error } = await supabase
      .from("offers")
      .update({ is_active: nextValue })
      .eq("id", item.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setItems((prev) =>
      prev.map((current) =>
        current.id === item.id
          ? { ...current, is_active: nextValue }
          : current
      )
    );

    toast.success(nextValue ? "Nabídka je znovu viditelná" : "Nabídka je skrytá");
  }

  async function archiveOffer(item: Offer) {
    if (pendingDeleteId !== item.id) {
      setPendingDeleteId(item.id);
      return;
    }

    const response = await fetch("/api/offers/archive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offerId: item.id,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Nabídka se nepodařilo archivovat");
      return;
    }

    setItems((current) =>
      current.filter((i) => i.id !== item.id)
    );

    setPendingDeleteId(null);
    toast.success("Nabídka byla archivována");
  }

  const counts = useMemo(() => {
    return {
      all: items.length,
      available: items.filter((item) => item.is_active && !item.is_reserved_today).length,
      reserved: items.filter((item) => item.is_active && item.is_reserved_today).length,
    };
  }, [items]);

  const filteredOffers = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();

      result = result.filter((item) =>
        `${item.title} ${item.category} ${item.pickup_place}`
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

    if (statusFilter === "available") {
      result = result.filter((item) => item.is_active && !item.is_reserved_today);
    }

    if (statusFilter === "reserved") {
      result = result.filter((item) => item.is_active && item.is_reserved_today);
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
  }, [items, searchQuery, offerType, category, statusFilter, sortBy]);

  const visibleOffers = filteredOffers.slice(0, visibleCount);

  if (loading) {
    return (
      <main className="min-h-screen">
        <PageLoader />
      </main>
    );
  }

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <BackLink href="/dashboard">Dashboard</BackLink>
            <p className="koluj-pill w-fit bg-[var(--koluj-green-pale)] text-[var(--koluj-green)]">
              Můj prostor
            </p>
          </div>

          <h1 className="koluj-heading mt-6">Moje nabídky</h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Spravuj své nabídky, sleduj jejich stav a rezervace.
          </p>
        </section>

        <section className="mt-6">
          <OfferSearchFilters
            search={searchQuery}
            onSearchChange={setSearchQuery}
            offerType={offerType}
            onOfferTypeChange={(value) => {
              setOfferType(value);
              setCategory("all");
            }}
            offerTypeOptions={[
              { value: "all", label: "Vše" },
              ...Object.entries(offerTypeLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            category={category}
            onCategoryChange={setCategory}
            categoryOptions={Object.entries(getCategoryOptions(offerType)).map(
              ([value, label]) => ({ value, label })
            )}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            statusOptions={[
              { value: "all", label: `Všechny stavy (${counts.all})` },
              { value: "available", label: `Volné (${counts.available})` },
              { value: "reserved", label: `Rezervované (${counts.reserved})` },
            ]}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOptions={[
              { value: "newest", label: "Nejnovější" },
              { value: "oldest", label: "Nejstarší" },
              { value: "az", label: "Název A–Z" },
              { value: "za", label: "Název Z–A" },
            ]}
          />

          <div className="mb-8 mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="font-bold text-[var(--koluj-muted)]">
              {filteredOffers.length}{" "}
              {filteredOffers.length === 1 ? "nabídku" : "nabídek"}
            </p>
          </div>

          {items.length === 0 ? (
            <div className="koluj-card p-12 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
                <Box size={36} />
              </div>

              <h2 className="text-3xl font-black">Zatím nemáš žádnou nabídku</h2>

              <p className="mt-3 text-lg text-[var(--koluj-muted)]">
                Přidej první nabídku a začni rezervovat.
              </p>

            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="koluj-card p-10 text-center">
              <h2 className="text-2xl font-black">Nic nenalezeno</h2>
              <p className="mt-2 text-[var(--koluj-muted)]">
                Zkus změnit vyhledávání nebo filtr.
              </p>
            </div>
          ) : (
            <div className="koluj-offer-grid-wide">
              {visibleOffers.map((item) => {

                return (
                <OfferCard
                  key={item.id}
                  item={item}
                  variant="owner"
                  footer={
                    <>
                      {!item.is_active && (
                        <p className="mb-3 rounded-2xl bg-[var(--koluj-bg)] px-4 py-2 text-sm font-bold text-[var(--koluj-muted)]">
                          Skryto pro ostatní
                        </p>
                      )}

                      <div className="grid grid-cols-4 gap-1">
                        <Link
                          href={`/offers/${item.id}`}
                          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]"
                        >
                          <CalendarDays size={18} />
                          Detail
                        </Link>

                        <Link
                          href={`/offers/${item.id}/edit`}
                          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight text-[var(--koluj-text)] hover:bg-[var(--koluj-bg)]"
                        >
                          <Pencil size={18} />
                          Upravit
                        </Link>

                        <button
                          type="button"
                          onClick={() => toggleVisibility(item)}
                          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight text-[var(--koluj-green)] hover:bg-[var(--koluj-bg)]"
                        >
                          {item.is_active ? (
                            <>
                              <EyeOff size={18} />
                              Skrýt
                            </>
                          ) : (
                            <>
                              <Eye size={18} />
                              Obnovit
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => archiveOffer(item)}
                          onMouseLeave={() => setPendingDeleteId(null)}
                          className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight ${
                            pendingDeleteId === item.id
                              ? "bg-red-50 text-red-600"
                              : "text-[var(--koluj-muted)] hover:bg-[var(--koluj-bg)]"
                          }`}
                        >
                          <Trash2 size={18} />
                          {pendingDeleteId === item.id ? "Opravdu?" : "Odstranit"}
                        </button>
                      </div>
                    </>
                  }
                />
                );
              })}
            </div>
          )}

          {visibleCount < filteredOffers.length && (
            <div className="pt-8 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 8)}
                className="koluj-button-secondary min-h-[52px] px-8"
              >
                Načíst další
              </button>

              <p className="mt-3 text-sm text-[var(--koluj-muted)]">
                Zobrazeno {visibleOffers.length} z {filteredOffers.length} nabídek
              </p>
            </div>
          )}
        </section>

        <section className="koluj-card mt-10 px-8 py-6">
          <p className="text-[var(--koluj-muted)]">
            <span className="font-bold text-[var(--koluj-green)]">Tip:</span>{" "}
            Udržuj své nabídky aktuální. Zvyšuješ tím šanci, že si je někdo rezervuje.
          </p>
        </section>
      </div>
    </main>
  );
}
