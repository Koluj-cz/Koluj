"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarOff, Check, Package, X } from "lucide-react";
import toast from "react-hot-toast";
import BackLink from "@/app/components/BackLink";
import PageLoader from "@/app/components/PageLoader";
import { supabase } from "@/lib/supabase";

type OwnerItem = {
  id: string;
  title: string;
  primary_image_url: string | null;
  is_active: boolean | null;
};

type BulkResult = {
  ok: boolean;
  createdCount: number;
  skippedCount: number;
  created: { id: string; itemId: string; title: string }[];
  skipped: { itemId: string; title: string; reason: string }[];
};

export default function DashboardAvailabilityPage() {
  const [items, setItems] = useState<OwnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");
  const [lastResult, setLastResult] = useState<BulkResult | null>(null);

  const todayIso = new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadItems();
  }, []);

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
      .select("id, title, primary_image_url, is_active")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setItems((data || []) as OwnerItem[]);
    setSelectedItemIds((data || []).map((item) => item.id));
    setLoading(false);
  }

  function toggleItem(itemId: string) {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    );
  }

  function selectAll() {
    setSelectedItemIds(items.map((item) => item.id));
  }

  function clearSelection() {
    setSelectedItemIds([]);
  }

  async function submitBlock() {
    if (saving) return;

    if (!dateFrom || !dateTo) {
      toast.error("Vyber termín blokace.");
      return;
    }

    if (dateTo < dateFrom) {
      toast.error("Datum konce nemůže být dřív než začátek.");
      return;
    }

    if (!applyToAll && selectedItemIds.length === 0) {
      toast.error("Vyber alespoň jednu věc.");
      return;
    }

    setSaving(true);
    setLastResult(null);

    const response = await fetch("/api/dashboard/availability/block", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateFrom,
        dateTo,
        reason,
        applyToAll,
        itemIds: applyToAll ? [] : selectedItemIds,
      }),
    });

    const result = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      toast.error(result?.error || "Blokaci se nepodařilo vytvořit.");
      return;
    }

    setLastResult(result as BulkResult);

    if (result.createdCount > 0) {
      toast.success(`Zablokováno ${result.createdCount} věcí.`);
    }

    if (result.skippedCount > 0) {
      toast.error(`${result.skippedCount} věcí se nepodařilo zablokovat.`);
    }
  }

  const selectedCount = applyToAll ? items.length : selectedItemIds.length;

  const inactiveCount = useMemo(
    () => items.filter((item) => !item.is_active).length,
    [items]
  );

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

          <Link
            href="/dashboard/my-items"
            className="koluj-button px-6 py-3"
          >
            Moje věci
          </Link>
        </header>

        <section className="mt-12">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-[var(--koluj-green)] shadow-sm">
            <CalendarOff size={30} />
          </div>

          <h1 className="koluj-heading mt-6">Dostupnost</h1>

          <p className="mt-6 max-w-3xl text-2xl leading-relaxed text-[var(--koluj-muted)]">
            Zablokuj termín pro jednu, více nebo všechny své věci. Hodí se třeba
            na dovolenou, servis nebo období, kdy nechceš věci půjčovat.
          </p>
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <div className="koluj-card p-6 md:p-8">
              <h2 className="text-2xl font-black">Termín blokace</h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
                  Od kdy
                  <input
                    type="date"
                    min={todayIso}
                    value={dateFrom}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDateFrom(value);

                      if (!dateTo || dateTo < value) {
                        setDateTo(value);
                      }
                    }}
                    className="koluj-input"
                  />
                </label>

                <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
                  Do kdy
                  <input
                    type="date"
                    min={dateFrom || todayIso}
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="koluj-input"
                  />
                </label>
              </div>

              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Poznámka k blokaci, např. dovolená nebo servis"
                className="koluj-input mt-5 min-h-28"
              />
            </div>

            <div className="koluj-card p-6 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Na které věci se vztahuje?</h2>
                  <p className="mt-2 text-[var(--koluj-muted)]">
                    Vyber všechny věci, nebo jen konkrétní položky.
                  </p>
                </div>

                <div className="flex rounded-2xl bg-[var(--koluj-bg)] p-1 text-sm font-black">
                  <button
                    type="button"
                    onClick={() => setApplyToAll(true)}
                    className={`rounded-xl px-4 py-2 transition ${
                      applyToAll
                        ? "bg-white text-[var(--koluj-green)] shadow-sm"
                        : "text-[var(--koluj-muted)]"
                    }`}
                  >
                    Všechny
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplyToAll(false)}
                    className={`rounded-xl px-4 py-2 transition ${
                      !applyToAll
                        ? "bg-white text-[var(--koluj-green)] shadow-sm"
                        : "text-[var(--koluj-muted)]"
                    }`}
                  >
                    Vybrané
                  </button>
                </div>
              </div>

              {!applyToAll && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="rounded-2xl bg-[var(--koluj-bg)] px-4 py-2 text-sm font-black text-[var(--koluj-green)]"
                  >
                    Vybrat vše
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-2xl bg-[var(--koluj-bg)] px-4 py-2 text-sm font-black text-[var(--koluj-muted)]"
                  >
                    Zrušit výběr
                  </button>
                </div>
              )}

              {items.length === 0 ? (
                <div className="mt-8 rounded-3xl bg-[var(--koluj-bg)] p-8 text-center">
                  <Package size={34} className="mx-auto text-[var(--koluj-green)]" />
                  <h3 className="mt-4 text-2xl font-black">Zatím nemáš žádné věci</h3>
                  <p className="mt-2 text-[var(--koluj-muted)]">
                    Přidej první věc a potom jí můžeš nastavovat dostupnost.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {items.map((item) => {
                    const selected = selectedItemIds.includes(item.id);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={applyToAll}
                        onClick={() => toggleItem(item.id)}
                        className={`flex items-center gap-4 rounded-3xl p-3 text-left transition ${
                          applyToAll || selected
                            ? "bg-[var(--koluj-bg)]"
                            : "bg-white ring-1 ring-[var(--koluj-border)]"
                        } ${applyToAll ? "cursor-default" : "hover:bg-[var(--koluj-bg)]"}`}
                      >
                        {item.primary_image_url ? (
                          <img
                            src={item.primary_image_url}
                            alt={item.title}
                            className="h-16 w-16 rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[var(--koluj-green)]">
                            <Package size={22} />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black">{item.title}</p>
                          <p className="mt-1 text-sm font-bold text-[var(--koluj-muted)]">
                            {item.is_active ? "Viditelná" : "Skrytá"}
                          </p>
                        </div>

                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            applyToAll || selected
                              ? "bg-[var(--koluj-green)] text-white"
                              : "bg-[var(--koluj-bg)] text-[var(--koluj-muted)]"
                          }`}
                        >
                          {applyToAll || selected ? <Check size={16} /> : <X size={16} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {lastResult && (
              <div className="koluj-card p-6 md:p-8">
                <h2 className="text-2xl font-black">Výsledek</h2>

                <p className="mt-4 font-bold text-[var(--koluj-muted)]">
                  Zablokováno: <span className="text-[var(--koluj-green)]">{lastResult.createdCount}</span>
                  {" · "}
                  Přeskočeno: <span className="text-red-600">{lastResult.skippedCount}</span>
                </p>

                {lastResult.skipped.length > 0 && (
                  <div className="mt-5 space-y-2">
                    {lastResult.skipped.map((item) => (
                      <div
                        key={item.itemId}
                        className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700"
                      >
                        {item.title}: {item.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="koluj-card sticky top-8 p-6 md:p-8">
              <h2 className="text-2xl font-black">Souhrn</h2>

              <div className="mt-6 space-y-4 text-[var(--koluj-muted)]">
                <SummaryLine label="Počet věcí" value={String(items.length)} />
                <SummaryLine label="Skrytých věcí" value={String(inactiveCount)} />
                <SummaryLine label="Vybráno" value={String(selectedCount)} />
              </div>

              <button
                type="button"
                onClick={submitBlock}
                disabled={saving || items.length === 0}
                className="koluj-button mt-8 w-full px-6 py-4 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Ukládám..." : "Zablokovat termín"}
              </button>

              <p className="mt-4 text-sm leading-relaxed text-[var(--koluj-muted)]">
                Pokud je některá věc v daném termínu už rezervovaná, nebude se blokovat
                a zobrazí se ve výsledku jako přeskočená.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[var(--koluj-bg)] px-4 py-3 font-bold">
      <span>{label}</span>
      <span className="text-[var(--koluj-green)]">{value}</span>
    </div>
  );
}
