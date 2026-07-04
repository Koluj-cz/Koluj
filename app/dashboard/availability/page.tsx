"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Package,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import PageLoader from "@/app/components/PageLoader";
import { supabase } from "@/lib/supabase";

type OwnerItem = {
  id: string;
  title: string;
  primary_image_url: string | null;
  is_active: boolean | null;
};

type OwnerBlock = {
  id: string;
  offer_id: string;
  date_from: string;
  date_to: string;
  reason: string | null;
  offers?: {
    title: string | null;
  } | null;
};

type OwnerReservation = {
  id: string;
  offer_id: string;
  booking_id: string;
  date_from: string;
  date_to: string;
  status: string;
  offers?: {
    title: string | null;
  } | null;
};

type SelectedRange = {
  dateFrom: string;
  dateTo: string;
};

type BulkResult = {
  ok: boolean;
  createdCount: number;
  skippedCount: number;
  created: { id: string; offerId: string; title: string }[];
  skipped: { offerId: string; title: string; reason: string }[];
};

const monthNames = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
];

const dayLabels = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatShortDate(value: string) {
  return parseIsoDate(value).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function eachDateInRange(dateFrom: string, dateTo: string) {
  const dates: string[] = [];
  let current = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);

  while (current <= end) {
    dates.push(toIsoDate(current));
    current = addDays(current, 1);
  }

  return dates;
}

function buildMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const leadingEmptyDays = (first.getDay() + 6) % 7;
  const days: (Date | null)[] = Array.from(
    { length: leadingEmptyDays },
    () => null
  );

  for (let day = 1; day <= last.getDate(); day++) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

export default function DashboardAvailabilityPage() {
  const [items, setItems] = useState<OwnerItem[]>([]);
  const [blocks, setBlocks] = useState<OwnerBlock[]>([]);
  const [reservations, setReservations] = useState<OwnerReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(null);
  const [activeDate, setActiveDate] = useState(() => toIsoDate(new Date()));
  const [reason, setReason] = useState("");
  const [lastResult, setLastResult] = useState<BulkResult | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const todayIso = toIsoDate(new Date());
  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);

  const firstVisibleDate = toIsoDate(
    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  );
  const lastVisibleDate = toIsoDate(
    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0)
  );

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      loadAvailability();
    }
  }, [items, firstVisibleDate, lastVisibleDate]);

  async function loadItems() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("offers")
      .select("id, title, primary_image_url, is_active")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const loadedItems = (data || []) as OwnerItem[];

    setItems(loadedItems);
    setSelectedItemIds(loadedItems.map((item) => item.id));
    setLoading(false);
  }

  async function loadAvailability() {
    const offerIds = items.map((item) => item.id);

    if (offerIds.length === 0) {
      setBlocks([]);
      setReservations([]);
      return;
    }

    const [blocksResult, reservationsResult] = await Promise.all([
      supabase
        .from("offer_availability_blocks")
        .select("id, offer_id, date_from, date_to, reason, offers:offers(title)")
        .in("offer_id", offerIds)
        .lte("date_from", lastVisibleDate)
        .gte("date_to", firstVisibleDate)
        .order("date_from", { ascending: true }),
      supabase
        .from("offer_reservations")
        .select("id, offer_id, booking_id, date_from, date_to, status, offers:offers(title)")
        .in("offer_id", offerIds)
        .eq("status", "active")
        .lte("date_from", lastVisibleDate)
        .gte("date_to", firstVisibleDate)
        .order("date_from", { ascending: true }),
    ]);

    if (blocksResult.error) {
      toast.error(blocksResult.error.message);
    } else {
      setBlocks((blocksResult.data || []) as unknown as OwnerBlock[]);
    }

    if (reservationsResult.error) {
      toast.error(reservationsResult.error.message);
    } else {
      setReservations((reservationsResult.data || []) as unknown as OwnerReservation[]);
    }
  }

  function toggleItem(offerId: string) {
    setSelectedItemIds((current) =>
      current.includes(offerId)
        ? current.filter((id) => id !== offerId)
        : [...current, offerId]
    );
  }

  function selectAll() {
    setSelectedItemIds(items.map((item) => item.id));
  }

  function clearSelection() {
    setSelectedItemIds([]);
  }

  function previousMonth() {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
  }

  function nextMonth() {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
  }


  const selectedDates = useMemo(() => {
    const dates = new Set<string>();

    if (selectedRange?.dateFrom && selectedRange?.dateTo) {
      eachDateInRange(selectedRange.dateFrom, selectedRange.dateTo).forEach((date) =>
        dates.add(date)
      );
    }

    return dates;
  }, [selectedRange]);

  const activeDateBlocks = useMemo(
    () =>
      blocks.filter(
        (block) => block.date_from <= activeDate && block.date_to >= activeDate
      ),
    [blocks, activeDate]
  );

  const activeDateReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) =>
          reservation.date_from <= activeDate && reservation.date_to >= activeDate
      ),
    [reservations, activeDate]
  );


  function countBlocksForDate(date: string) {
    return blocks.filter((block) => block.date_from <= date && block.date_to >= date)
      .length;
  }

  function countReservationsForDate(date: string) {
    return reservations.filter(
      (reservation) => reservation.date_from <= date && reservation.date_to >= date
    ).length;
  }

  function handleDayClick(date: string) {
    setActiveDate(date);

    if (date < todayIso) return;

    if (
      !selectedRange?.dateFrom ||
      (selectedRange.dateTo && selectedRange.dateTo !== selectedRange.dateFrom)
    ) {
      setSelectedRange({ dateFrom: date, dateTo: date });
      return;
    }

    if (date < selectedRange.dateFrom) {
      setSelectedRange({ dateFrom: date, dateTo: selectedRange.dateFrom });
      return;
    }

    setSelectedRange({ dateFrom: selectedRange.dateFrom, dateTo: date });
  }

  async function submitBlock() {
    if (saving) return;

    if (!selectedRange?.dateFrom || !selectedRange?.dateTo) {
      toast.error("Vyber termín blokace v kalendáři.");
      return;
    }

    if (!applyToAll && selectedItemIds.length === 0) {
      toast.error("Vyber alespoň jednu nabídku.");
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
        dateFrom: selectedRange.dateFrom,
        dateTo: selectedRange.dateTo,
        reason,
        applyToAll,
        offerIds: applyToAll ? [] : selectedItemIds,
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
      toast.success(`Zablokováno ${result.createdCount} nabídek.`);
      setReason("");
      setSelectedRange(null);
      loadAvailability();
    }

    if (result.skippedCount > 0) {
      toast.error(`${result.skippedCount} nabídek se nepodařilo zablokovat.`);
    }
  }

  async function deleteBlock(blockId: string) {
    if (deletingBlockId) return;

    setDeletingBlockId(blockId);

    const response = await fetch(`/api/dashboard/availability/block/${blockId}`, {
      method: "DELETE",
    });

    const result = await response.json().catch(() => null);
    setDeletingBlockId(null);

    if (!response.ok) {
      toast.error(result?.error || "Blokaci se nepodařilo zrušit.");
      return;
    }

    toast.success("Blokace byla zrušena.");
    loadAvailability();
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
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <p className="koluj-pill w-fit bg-[var(--koluj-green-pale)] text-[var(--koluj-green)]">
            Můj prostor
          </p>

          <h1 className="koluj-heading mt-6">Dostupnost</h1>

          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
            Spravuj dostupnost všech nabídek v jednom kalendáři. Vyber termín,
            zvol nabídky a ulož blokaci.
          </p>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="koluj-card overflow-hidden p-0">
            <div className="flex flex-col gap-4 border-b border-[var(--koluj-border)] p-5 md:flex-row md:items-center md:justify-between md:p-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={previousMonth}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
                  aria-label="Předchozí měsíc"
                >
                  <ChevronLeft size={24} />
                </button>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
                  aria-label="Další měsíc"
                >
                  <ChevronRight size={24} />
                </button>

                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
                    Centrální kalendář
                  </p>
                  <h2 className="text-3xl font-black leading-none tracking-tight">
                    {monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-bold text-[var(--koluj-muted)]">
                <LegendDot className="bg-white" label="Volné" />
                <LegendDot className="bg-red-100" label="Rezervace" />
                <LegendDot className="bg-stone-300" label="Blokace" />
                <LegendDot className="bg-orange-100" label="Vybráno" />
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-[var(--koluj-border)] bg-[var(--koluj-bg)] text-center text-xs font-black uppercase text-[var(--koluj-muted)]">
              {dayLabels.map((day) => (
                <div key={day} className="py-3">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 bg-[var(--koluj-border)] gap-px">
              {days.map((day, index) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-[96px] bg-white/35 md:min-h-[132px]"
                    />
                  );
                }

                const isoDate = toIsoDate(day);
                const isToday = isoDate === todayIso;
                const isActive = isoDate === activeDate;
                const isPast = isoDate < todayIso;
                const selected = selectedDates.has(isoDate);
                const reservationCount = countReservationsForDate(isoDate);
                const blockCount = countBlocksForDate(isoDate);

                return (
                  <button
                    key={isoDate}
                    type="button"
                    onClick={() => handleDayClick(isoDate)}
                    className={`min-h-[96px] bg-white p-2 text-left hover:bg-[var(--koluj-bg)] md:min-h-[132px] md:p-3 ${
                      selected ? "bg-orange-50 ring-2 ring-inset ring-orange-300" : ""
                    } ${isActive ? "ring-2 ring-inset ring-[var(--koluj-green)]" : ""} ${
                      isPast ? "text-stone-300" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${
                          isToday
                            ? "bg-[var(--koluj-green)] text-white"
                            : "text-[var(--koluj-text)]"
                        } ${isPast ? "text-stone-300" : ""}`}
                      >
                        {day.getDate()}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      {reservationCount > 0 && (
                        <CalendarPill className="bg-red-100 text-red-700">
                          {reservationCount}× rezervace
                        </CalendarPill>
                      )}

                      {blockCount > 0 && (
                        <CalendarPill className="bg-stone-200 text-stone-700">
                          {blockCount}× blokace
                        </CalendarPill>
                      )}

                      {selected && (
                        <CalendarPill className="bg-orange-100 text-orange-800">
                          vybráno
                        </CalendarPill>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="koluj-card p-6 md:p-8">
              <h2 className="text-2xl font-black">Nová blokace</h2>

              {selectedRange?.dateFrom && selectedRange?.dateTo ? (
                <div className="mt-5 rounded-3xl bg-[var(--koluj-bg)] p-5 font-bold text-[var(--koluj-muted)]">
                  <p className="text-sm uppercase tracking-wide">Vybraný termín</p>
                  <p className="mt-1 text-xl font-black text-[var(--koluj-text)]">
                    {formatShortDate(selectedRange.dateFrom)} – {formatShortDate(selectedRange.dateTo)}
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-3xl bg-[var(--koluj-bg)] p-5 font-bold text-[var(--koluj-muted)]">
                  Klikni na první a poslední den v kalendáři.
                </div>
              )}

              <div className="mt-5 flex rounded-2xl bg-[var(--koluj-bg)] p-1 text-sm font-black">
                <button
                  type="button"
                  onClick={() => setApplyToAll(true)}
                  className={`flex-1 rounded-xl px-4 py-2 ${
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
                  className={`flex-1 rounded-xl px-4 py-2 ${
                    !applyToAll
                      ? "bg-white text-[var(--koluj-green)] shadow-sm"
                      : "text-[var(--koluj-muted)]"
                  }`}
                >
                  Vybrané
                </button>
              </div>

              {!applyToAll && (
                <div className="mt-5">
                  <div className="mb-3 flex flex-wrap gap-2">
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

                  <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                    {items.map((item) => {
                      const selected = selectedItemIds.includes(item.id);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left ${
                            selected
                              ? "bg-[var(--koluj-bg)]"
                              : "bg-white ring-1 ring-[var(--koluj-border)] hover:bg-[var(--koluj-bg)]"
                          }`}
                        >
                          {item.primary_image_url ? (
                            <img
                              src={item.primary_image_url}
                              alt={item.title}
                              className="h-11 w-11 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--koluj-bg)] text-[var(--koluj-green)]">
                              <Package size={18} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black">{item.title}</p>
                            <p className="text-xs font-bold text-[var(--koluj-muted)]">
                              {item.is_active ? "Viditelná" : "Skrytá"}
                            </p>
                          </div>

                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full ${
                              selected
                                ? "bg-[var(--koluj-green)] text-white"
                                : "bg-[var(--koluj-bg)] text-[var(--koluj-muted)]"
                            }`}
                          >
                            {selected ? <Check size={14} /> : <X size={14} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Poznámka, např. dovolená nebo servis"
                className="koluj-input mt-5 min-h-24"
              />

              <div className="mt-5 space-y-3 text-sm font-bold text-[var(--koluj-muted)]">
                <SummaryLine label="Počet nabídek" value={String(items.length)} />
                <SummaryLine label="Skrytých nabídek" value={String(inactiveCount)} />
                <SummaryLine label="Vybráno" value={String(selectedCount)} />
              </div>

              <button
                type="button"
                onClick={submitBlock}
                disabled={saving || items.length === 0 || !selectedRange}
                className="koluj-button mt-6 w-full px-6 py-4 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Ukládám..." : "Zablokovat termín"}
              </button>

              <p className="mt-4 text-sm leading-relaxed text-[var(--koluj-muted)]">
                Pokud je některá nabídka v termínu už rezervovaná, server ji přeskočí
                a zobrazí ji ve výsledku.
              </p>

              <div className="mt-6 rounded-3xl bg-[var(--koluj-bg)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
                      Vybraný den
                    </p>
                    <h3 className="mt-1 text-xl font-black">{formatShortDate(activeDate)}</h3>
                  </div>

                  <div className="flex shrink-0 gap-2 text-xs font-black">
                    {activeDateReservations.length > 0 && (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                        {activeDateReservations.length}× rezervace
                      </span>
                    )}
                    {activeDateBlocks.length > 0 && (
                      <span className="rounded-full bg-stone-200 px-3 py-1 text-stone-700">
                        {activeDateBlocks.length}× blokace
                      </span>
                    )}
                  </div>
                </div>

                {activeDateReservations.length === 0 && activeDateBlocks.length === 0 ? (
                  <p className="mt-4 text-sm font-bold text-[var(--koluj-muted)]">
                    V tento den nejsou žádné rezervace ani blokace.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {activeDateReservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
                      >
                        <p>{reservation.offers?.title || "Nabídka"}</p>
                        <p className="mt-1 text-xs opacity-80">
                          {formatShortDate(reservation.date_from)} – {formatShortDate(reservation.date_to)}
                        </p>
                      </div>
                    ))}

                    {activeDateBlocks.map((block) => (
                      <div
                        key={block.id}
                        className="rounded-2xl bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">
                              {block.offers?.title || "Nabídka"}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[var(--koluj-muted)]">
                              {formatShortDate(block.date_from)} – {formatShortDate(block.date_to)}
                              {block.reason ? ` · ${block.reason}` : ""}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => deleteBlock(block.id)}
                            disabled={deletingBlockId === block.id}
                            className="shrink-0 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-100 disabled:opacity-60"
                          >
                            {deletingBlockId === block.id ? "Ruším..." : "Uvolnit"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {lastResult && (
                <div className="mt-6 rounded-3xl bg-[var(--koluj-bg)] p-5">
                  <p className="font-black">Výsledek poslední blokace</p>
                  <p className="mt-2 text-sm font-bold text-[var(--koluj-muted)]">
                    Zablokováno: <span className="text-[var(--koluj-green)]">{lastResult.createdCount}</span>
                    {" · "}
                    Přeskočeno: <span className="text-red-600">{lastResult.skippedCount}</span>
                  </p>

                  {lastResult.skipped.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {lastResult.skipped.map((item) => (
                        <div
                          key={item.offerId}
                          className="rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700"
                        >
                          {item.title}: {item.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function CalendarPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <div className={`truncate rounded-full px-2 py-1 text-[10px] font-black leading-none ${className}`}>
      {children}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--koluj-bg)] px-3 py-2">
      <span className={`h-3 w-3 rounded-full ring-1 ring-black/5 ${className}`} />
      {label}
    </span>
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
