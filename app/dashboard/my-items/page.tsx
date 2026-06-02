"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Box,
  CalendarDays,
  Eye,
  EyeOff,
  Grid2X2,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  Star,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { Banknote } from "lucide-react";

type Item = {
  id: string;
  title: string;
  category: string;
  condition: string | null;
  status: string | null;
  is_active: boolean;
  borrow_count: number;
  pickup_place: string;
  primary_image_url: string | null;
  created_at: string;
  price_amount: number | null;
  price_unit: string | null;
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

const conditionLabels: Record<string, string> = {
  new: "Nové",
  like_new: "Jako nové",
  good: "Dobrý stav",
  used: "Běžně používané",
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
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setItems(data || []);
    setLoading(false);
  }

  async function updateStatus(item: Item, status: string) {
    const { error } = await supabase
      .from("items")
      .update({ status })
      .eq("id", item.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setItems((prev) =>
      prev.map((current) =>
        current.id === item.id ? { ...current, status } : current
      )
    );

    toast.success("Stav věci změněn");
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

  async function deleteItem(item: Item) {
    if (pendingDeleteId !== item.id) {
      setPendingDeleteId(item.id);
      return;
    }

    const { data: images } = await supabase
      .from("item_images")
      .select("image_url")
      .eq("item_id", item.id);

    const storagePaths =
      images
        ?.map((image) => {
          const marker = "/storage/v1/object/public/items/";
          return image.image_url?.includes(marker)
            ? image.image_url.split(marker)[1]
            : null;
        })
        .filter(Boolean) || [];

    if (storagePaths.length > 0) {
      await supabase.storage.from("items").remove(storagePaths as string[]);
    }

    const { error: imageError } = await supabase
      .from("item_images")
      .delete()
      .eq("item_id", item.id);

    if (imageError) {
      toast.error(imageError.message);
      return;
    }

    const { error } = await supabase.from("items").delete().eq("id", item.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setItems((prev) => prev.filter((current) => current.id !== item.id));
    setPendingDeleteId(null);
    toast.success("Věc byla smazána");
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("cs-CZ");
  }

  function translatePriceUnit(unit: string | null) {
  if (unit === "hour") return "hodinu";
  if (unit === "day") return "den";
  if (unit === "week") return "týden";
  if (unit === "month") return "měsíc";
  if (unit === "piece") return "půjčení";
  return "";
}

  const counts = useMemo(() => {
    return {
      all: items.length,
      available: items.filter((item) => item.status === "available").length,
      reserved: items.filter((item) => item.status === "reserved").length,
      borrowed: items.filter((item) => item.status === "borrowed").length,
      hidden: items.filter((item) => !item.is_active).length,
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

    if (statusFilter === "hidden") {
      result = result.filter((item) => !item.is_active);
    } else if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter);
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
        <div className="koluj-shell">
          <p>Načítám...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="koluj-shell">
        <header className="mb-8 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-[var(--koluj-green)]"
          >
            <ArrowLeft size={20} />
            Dashboard
          </Link>

          <Link href="/items/new" className="koluj-button px-6 py-3">
            + Přidat věc
          </Link>
        </header>

        <section className="mt-16 px-8">
          <h1 className="koluj-heading">
            Moje věci
          </h1>

          <p className="mt-6 max-w-2xl text-2xl leading-relaxed text-[var(--koluj-muted)]">
            Spravuj své věci, měň jejich stav a sleduj půjčení.
          </p>
        </section>

        <section className="mt-12 px-8">
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
              <option value="borrowed">Půjčené</option>
              <option value="hidden">Skryté</option>
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
              <FilterButton
                active={statusFilter === "borrowed"}
                onClick={() => setStatusFilter("borrowed")}
                label="Půjčené"
                count={counts.borrowed}
              />
              <FilterButton
                active={statusFilter === "hidden"}
                onClick={() => setStatusFilter("hidden")}
                label="Skryté"
                count={counts.hidden}
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

              <Link
                href="/items/new"
                className="koluj-button mt-8 inline-flex items-center gap-2 px-6 py-3"
              >
                <Plus size={18} />
                Přidat věc
              </Link>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="koluj-card p-10 text-center">
              <h2 className="text-2xl font-black">Nic nenalezeno</h2>
              <p className="mt-2 text-[var(--koluj-muted)]">
                Zkus změnit vyhledávání nebo filtr.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleItems.map((item) => {
                const status = item.status || "available";

                return (
                  <article
                    key={item.id}
                    className="koluj-card overflow-hidden p-0"
                  >
                    <div className="grid gap-0 lg:grid-cols-[240px_1fr]">
                    <div className="bg-[var(--koluj-bg)] p-4">
                    <div className="relative aspect-[7/8] overflow-hidden rounded-3xl bg-white">
                        {item.primary_image_url ? (
                        <img
                            src={item.primary_image_url}
                            alt={item.title}
                            className="h-full w-full object-cover"
                        />
                        ) : (
                        <div className="flex h-full items-center justify-center text-[var(--koluj-muted)]">
                            Bez fotky
                        </div>
                        )}

                        {item.price_amount && item.price_unit && (
                        <div className="absolute bottom-4 left-4 rounded-2xl bg-[var(--koluj-green)] px-4 py-2 shadow-sm">
                            <p className="font-black text-white">
                            {item.price_amount} Kč / {translatePriceUnit(item.price_unit)}
                            </p>
                        </div>
                        )}
                    </div>
                    </div>

                      <div className="p-5">
                        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <p className="text-sm font-black uppercase tracking-widest text-[var(--koluj-green)]">
                              {categoryLabels[item.category] || item.category}
                            </p>

                            <h2 className="mt-2 text-3xl font-black tracking-tight">
                              {item.title}
                            </h2>

                            {!item.is_active && (
                              <p className="mt-3 inline-flex rounded-full bg-[var(--koluj-bg)] px-3 py-1 text-sm font-bold text-[var(--koluj-muted)]">
                                Skryto pro ostatní
                              </p>
                            )}

                            <div className="mt-5 grid gap-x-8 gap-y-3 text-[var(--koluj-muted)] md:grid-cols-2 xl:grid-cols-4">

                            <p className="flex items-center gap-2">
                            <MapPin size={18} />
                            {item.pickup_place}
                            </p>

                              {item.condition && (
                                <p className="flex items-center gap-2">
                                  <Star size={18} />
                                  {conditionLabels[item.condition] ||
                                    item.condition}
                                </p>
                              )}



                              <p className="flex items-center gap-2">
                                <RefreshCcw size={18} />
                                {item.borrow_count || 0} půjčení
                              </p>

                              <p className="flex items-center gap-2">
                                <CalendarDays size={18} />
                                Přidáno {formatDate(item.created_at)}
                              </p>
                            </div>
                          </div>

                          <select
                            value={status}
                            onChange={(e) =>
                              updateStatus(item, e.target.value)
                            }
                              className={`min-w-40 rounded-2xl border px-4 py-3 text-center text-sm font-black uppercase tracking-wide outline-none ${
                                statusClasses[status] || "koluj-status-available"
                              }`}
                          >
                            <option value="available">Volné</option>
                            <option value="reserved">Rezervované</option>
                            <option value="borrowed">Půjčené</option>
                          </select>
                        </div>

                        <div className="mt-6 grid gap-3 border-t border-[var(--koluj-border)] pt-5 sm:grid-cols-3">
                          <Link
                            href={`/items/${item.id}/edit`}
                            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--koluj-border)] px-5 py-3 font-bold transition hover:bg-[var(--koluj-bg)]"
                          >
                            <Pencil size={18} />
                            Upravit
                          </Link>

                          <button
                            type="button"
                            onClick={() => toggleVisibility(item)}
                            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--koluj-border)] px-5 py-3 font-bold text-[var(--koluj-green)] transition hover:bg-[var(--koluj-bg)]"
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
                            onClick={() => deleteItem(item)}
                            onMouseLeave={() => setPendingDeleteId(null)}
                            className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 px-5 py-3 font-bold text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 size={18} />
                            {pendingDeleteId === item.id
                              ? "Opravdu smazat?"
                              : "Smazat"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              {visibleCount < filteredItems.length && (
                <div className="pt-6 text-center">
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
            </div>
          )}
        </section>

        <section className="koluj-card mx-8 mt-10 px-8 py-6">
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