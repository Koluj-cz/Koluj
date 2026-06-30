"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  CalendarDays,
  Eye,
  EyeOff,
  Grid2X2,
  Pencil,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import ItemCard, { type ItemCardItem } from "@/app/components/ItemCard";
import AddItemButton from "@/app/components/AddItemButton";
import BackLink from "@/app/components/BackLink";
import PageLoader from "@/app/components/PageLoader";


async function attachTodayAvailability<T extends { id: string }>(items: T[]) {
  if (items.length === 0) return items as (T & { is_reserved_today: boolean })[];

  const today = new Date().toISOString().split("T")[0];
  const itemIds = items.map((item) => item.id);

  const [reservationsResult, blocksResult] = await Promise.all([
    supabase
      .from("item_reservations")
      .select("item_id")
      .in("item_id", itemIds)
      .eq("status", "active")
      .lte("date_from", today)
      .gte("date_to", today),
    supabase
      .from("item_availability_blocks")
      .select("item_id")
      .in("item_id", itemIds)
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
    ...(reservationsResult.data || []).map((row) => row.item_id),
    ...(blocksResult.data || []).map((row) => row.item_id),
  ]);

  return items.map((item) => ({
    ...item,
    is_reserved_today: reservedIds.has(item.id),
  }));
}


type Item = ItemCardItem & {
  is_active: boolean;
  deleted_at: string | null;
  borrow_count: number | null;
};

export default function MyItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(8);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    setVisibleCount(8);
  }, [searchQuery, statusFilter, sortBy]);

  async function loadItems() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("items")
      .select(`
        *,
        loans:loans!loans_item_id_fkey (
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
      ((data || []) as Item[])
    );

    setItems(itemsWithAvailability);
    setLoading(false);
  }

  async function toggleVisibility(item: Item) {
    const nextValue = !item.is_active;

    const { error } = await supabase
      .from("items")
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

    toast.success(nextValue ? "Věc je znovu viditelná" : "Věc je skrytá");
  }

  async function archiveItem(item: Item) {
    if (pendingDeleteId !== item.id) {
      setPendingDeleteId(item.id);
      return;
    }

    const response = await fetch("/api/items/archive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        itemId: item.id,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Věc se nepodařilo archivovat");
      return;
    }

    setItems((current) =>
      current.filter((i) => i.id !== item.id)
    );

    setPendingDeleteId(null);
    toast.success("Věc byla archivována");
  }

  const counts = useMemo(() => {
    return {
      all: items.length,
      available: items.filter((item) => item.is_active && !item.is_reserved_today).length,
      reserved: items.filter((item) => item.is_active && item.is_reserved_today).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();

      result = result.filter((item) =>
        `${item.title} ${item.category} ${item.pickup_place}`
          .toLowerCase()
          .includes(query)
      );
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
  }, [items, searchQuery, statusFilter, sortBy]);

  const visibleItems = filteredItems.slice(0, visibleCount);

  if (loading) {
    return (
      <main className="min-h-screen">
        <PageLoader />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="koluj-shell">
        <header className="koluj-page-header">
          <BackLink href="/dashboard">Dashboard</BackLink>

          <AddItemButton
            className="koluj-button flex items-center gap-2 px-6 py-3"
          />
        </header>

        <section className="mt-12">
          <h1 className="koluj-heading">Moje věci</h1>

          <p className="mt-6 max-w-2xl text-2xl leading-relaxed text-[var(--koluj-muted)]">
            Spravuj své věci, sleduj jejich stav a půjčení.
          </p>
        </section>

        <section className="mt-12">
          <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_260px_220px]">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat věc..."
              className="koluj-input"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="koluj-input"
            >
              <option value="all">Všechny stavy</option>
              <option value="available">Volné</option>
              <option value="reserved">Rezervované</option>
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

          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              <FilterButton
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
                icon={<Grid2X2 size={18} />}
                label="Všechny"
                count={counts.all}
              />
              <FilterButton
                active={statusFilter === "available"}
                onClick={() => setStatusFilter("available")}
                label="Volné"
                count={counts.available}
              />
              <FilterButton
                active={statusFilter === "reserved"}
                onClick={() => setStatusFilter("reserved")}
                label="Rezervované"
                count={counts.reserved}
              />
            </div>

            <p className="font-bold text-[var(--koluj-muted)]">
              {filteredItems.length}{" "}
              {filteredItems.length === 1 ? "věc" : "věcí"}
            </p>
          </div>

          {items.length === 0 ? (
            <div className="koluj-card p-12 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
                <Box size={36} />
              </div>

              <h2 className="text-3xl font-black">Zatím nemáš žádnou věc</h2>

              <p className="mt-3 text-lg text-[var(--koluj-muted)]">
                Přidej první věc a začni půjčovat.
              </p>

            </div>
          ) : filteredItems.length === 0 ? (
            <div className="koluj-card p-10 text-center">
              <h2 className="text-2xl font-black">Nic nenalezeno</h2>
              <p className="mt-2 text-[var(--koluj-muted)]">
                Zkus změnit vyhledávání nebo filtr.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleItems.map((item) => {

                return (
                <ItemCard
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
                          href={`/items/${item.id}`}
                          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight text-[var(--koluj-green)] transition hover:bg-[var(--koluj-bg)]"
                        >
                          <CalendarDays size={18} />
                          Detail
                        </Link>

                        <Link
                          href={`/items/${item.id}/edit`}
                          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight text-[var(--koluj-text)] transition hover:bg-[var(--koluj-bg)]"
                        >
                          <Pencil size={18} />
                          Upravit
                        </Link>

                        <button
                          type="button"
                          onClick={() => toggleVisibility(item)}
                          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight text-[var(--koluj-green)] transition hover:bg-[var(--koluj-bg)]"
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
                          onClick={() => archiveItem(item)}
                          onMouseLeave={() => setPendingDeleteId(null)}
                          className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-xs font-black leading-tight transition ${
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

          {visibleCount < filteredItems.length && (
            <div className="pt-8 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 8)}
                className="rounded-2xl border border-[var(--koluj-border)] bg-[var(--koluj-surface)] px-8 py-4 font-bold transition hover:bg-[var(--koluj-bg)]"
              >
                Načíst další
              </button>

              <p className="mt-3 text-sm text-[var(--koluj-muted)]">
                Zobrazeno {visibleItems.length} z {filteredItems.length} věcí
              </p>
            </div>
          )}
        </section>

        <section className="koluj-card mt-10 px-8 py-6">
          <p className="text-[var(--koluj-muted)]">
            <span className="font-bold text-[var(--koluj-green)]">Tip:</span>{" "}
            Udržuj své věci aktuální. Zvyšuješ tím šanci, že si je někdo půjčí.
          </p>
        </section>
      </div>
    </main>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl border px-5 py-3 font-bold transition ${
        active
          ? "border-[var(--koluj-green)] bg-[var(--koluj-green)] text-white"
          : "border-[var(--koluj-border)] bg-[var(--koluj-surface)] text-[var(--koluj-text)] hover:bg-[var(--koluj-bg)]"
      }`}
    >
      {icon}
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-sm ${
          active
            ? "bg-white/20 text-white"
            : "bg-[var(--koluj-bg)] text-[var(--koluj-muted)]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}