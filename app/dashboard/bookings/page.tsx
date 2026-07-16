"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Handshake,
  Inbox,
  Package,
  RotateCcw,
  XCircle,
} from "lucide-react";
import BackLink from "@/app/components/BackLink";
import PageLoader from "@/app/components/PageLoader";
import { bookingStatusLabels } from "@/lib/constants";
import {
  formatDateTime,
  getBookingDisplayStatus,
  getBookingFilterStatus,
} from "@/lib/format";

type BookingStatus =
  | "all"
  | "requested"
  | "approved"
  | "active"
  | "returned"
  | "cancelled";

type BookingGroupKey = "borrowing" | "lending";
type ViewMode = "all" | BookingGroupKey;

type Booking = {
  id: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  handed_over_at: string | null;
  returned_at: string | null;
  date_from: string | null;
  date_to: string | null;
  starts_at: string | null;
  ends_at: string | null;
  owner_id: string | null;
  customer_id: string | null;
  owner: { full_name: string | null } | null;
  customer: { full_name: string | null } | null;
  offers: {
    id: string;
    title: string;
    primary_image_url: string | null;
    offer_type: string | null;
    service_booking_mode?: string | null;
  } | null;
};

type BookingGroup = {
  key: BookingGroupKey;
  title: string;
  subtitle: string;
  emptyText: string;
  items: Booking[];
  loadedCount: number;
  total: number;
  onLoadMore: () => void;
};

const bookingStatuses: BookingStatus[] = [
  "all",
  "requested",
  "approved",
  "active",
  "returned",
  "cancelled",
];

const statusIcons: Record<Exclude<BookingStatus, "all">, ReactNode> = {
  requested: <Clock3 size={18} />,
  approved: <CheckCircle2 size={18} />,
  active: <Handshake size={18} />,
  returned: <RotateCcw size={18} />,
  cancelled: <XCircle size={18} />,
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


const displayStatusClasses: Record<string, string> = {
  requested: "bg-orange-100 text-orange-800",
  scheduled: "bg-blue-100 text-blue-800",
  approved: "bg-blue-100 text-blue-800",
  in_progress: "bg-green-100 text-green-800",
  active: "bg-green-100 text-green-800",
  awaiting_completion: "bg-amber-100 text-amber-800",
  completed: "bg-stone-200 text-stone-700",
  returned: "bg-stone-200 text-stone-700",
  cancelled: "bg-red-50 text-red-600",
};

function getDisplayStatus(booking: Booking) {
  return getBookingDisplayStatus({
    status: booking.status,
    offerType: booking.offers?.offer_type,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
  });
}

function getFilterStatus(booking: Booking): Exclude<BookingStatus, "all"> {
  return getBookingFilterStatus({
    status: booking.status,
    offerType: booking.offers?.offer_type,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
  });
}


function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00`);
}


function buildMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const leadingEmptyDays = (first.getDay() + 6) % 7;
  const days: (Date | null)[] = Array.from(
    { length: leadingEmptyDays },
    () => null,
  );

  for (let day = 1; day <= last.getDate(); day++) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function getBookingDateFrom(booking: Booking) {
  if (booking.date_from) return booking.date_from;
  if (booking.starts_at) return booking.starts_at.split("T")[0];

  return booking.created_at.split("T")[0];
}

function getBookingDateTo(booking: Booking) {
  if (booking.date_to) return booking.date_to;
  if (booking.ends_at) return booking.ends_at.split("T")[0];

  return getBookingDateFrom(booking);
}

function isBookingOnDate(booking: Booking, date: string) {
  const from = getBookingDateFrom(booking);
  const to = getBookingDateTo(booking);

  return from <= date && to >= date;
}

function formatBookingRange(booking: Booking) {
  const from = getBookingDateFrom(booking);
  const to = getBookingDateTo(booking);

  if (from === to) {
    return parseIsoDate(from).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  }

  return `${parseIsoDate(from).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
  })} – ${parseIsoDate(to).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })}`;
}


export default function BookingsPage() {
  const [borrowing, setBorrowing] = useState<Booking[]>([]);
  const [lending, setLending] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [showLists, setShowLists] = useState(false);
  const [visibleListCount, setVisibleListCount] = useState(10);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [activeDate, setActiveDate] = useState(() => toIsoDate(new Date()));

  const [borrowingPage] = useState(1);
  const [lendingPage] = useState(1);
  const [borrowingTotal, setBorrowingTotal] = useState(0);
  const [lendingTotal, setLendingTotal] = useState(0);

  const loadBookings = useCallback(async () => {
    const params = new URLSearchParams({
      borrowingPage: String(borrowingPage),
      lendingPage: String(lendingPage),
    });

    const response = await fetch(
      `/api/dashboard/bookings?${params.toString()}`,
      {
        cache: "no-store",
      },
    );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setLoading(false);
      return;
    }

    setBorrowing((result?.borrowing || []) as Booking[]);
    setLending((result?.lending || []) as Booking[]);
    setBorrowingTotal(Number(result?.borrowingTotal || 0));
    setLendingTotal(Number(result?.lendingTotal || 0));
    setLoading(false);
  }, [borrowingPage, lendingPage]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const allBookings = useMemo(
    () => [...borrowing, ...lending],
    [borrowing, lending],
  );

  const calendarDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const todayIso = toIsoDate(new Date());

  const filteredCalendarBookings = useMemo(() => {
    return allBookings.filter((booking) => {
      const matchesStatus = filter === "all" || getFilterStatus(booking) === filter;
      const matchesMode =
        viewMode === "all" ||
        (viewMode === "borrowing" && borrowing.some((item) => item.id === booking.id)) ||
        (viewMode === "lending" && lending.some((item) => item.id === booking.id));

      return matchesStatus && matchesMode;
    });
  }, [allBookings, borrowing, lending, filter, viewMode]);

  const activeDateBookings = useMemo(
    () =>
      filteredCalendarBookings
        .filter((booking) => isBookingOnDate(booking, activeDate))
        .sort((a, b) => getBookingDateFrom(a).localeCompare(getBookingDateFrom(b))),
    [activeDate, filteredCalendarBookings],
  );

  function previousMonth() {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
    );
  }

  function nextMonth() {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
    );
  }

  useEffect(() => {
    setVisibleListCount(10);
  }, [filter, viewMode]);

  const statusCounts = useMemo(() => {
    const counts: Record<BookingStatus, number> = {
      all: allBookings.length,
      requested: 0,
      approved: 0,
      active: 0,
      returned: 0,
      cancelled: 0,
    };

    allBookings.forEach((booking) => {
      const status = getFilterStatus(booking);
      counts[status] += 1;
    });

    return counts;
  }, [allBookings]);

  const filteredBorrowing = useMemo(() => {
    if (filter === "all") return borrowing;
    return borrowing.filter((booking) => getFilterStatus(booking) === filter);
  }, [borrowing, filter]);

  const filteredLending = useMemo(() => {
    if (filter === "all") return lending;
    return lending.filter((booking) => getFilterStatus(booking) === filter);
  }, [lending, filter]);

  const bookingGroups: BookingGroup[] = [
    {
      key: "borrowing",
      title: "Půjčuji si",
      subtitle: "Rezervace, které řešíš jako zájemce.",
      emptyText: "Žádné rezervace pro vybraný filtr.",
      items: filteredBorrowing.slice(0, visibleListCount),
      loadedCount: Math.min(filteredBorrowing.length, visibleListCount),
      total: filteredBorrowing.length,
      onLoadMore: () => setVisibleListCount((count) => count + 10),
    },
    {
      key: "lending",
      title: "Půjčuji ostatním",
      subtitle: "Žádosti a rezervace k tvým nabídkám.",
      emptyText: "Žádné rezervace pro vybraný filtr.",
      items: filteredLending.slice(0, visibleListCount),
      loadedCount: Math.min(filteredLending.length, visibleListCount),
      total: filteredLending.length,
      onLoadMore: () => setVisibleListCount((count) => count + 10),
    },
  ];

  const visibleGroups = bookingGroups.filter(
    (group) => viewMode === "all" || viewMode === group.key,
  );


  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackLink href="/dashboard" hideOnMobile>Dashboard</BackLink>
          </div>

          <div className="mt-8">
            <h1 className="koluj-heading mt-3">Rezervace</h1>

            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
              Primární přehled rezervací najdeš v kalendáři. Seznam níže si můžeš rozbalit
              jen tehdy, když chceš řešit detailnější přehled.
            </p>
          </div>
        </section>

        {loading ? (
          <PageLoader />
        ) : (
          <>
            <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="koluj-card p-3">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {bookingStatuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFilter(status)}
                      className={`rounded-2xl px-3 py-3 text-center text-sm font-black transition ${
                        filter === status
                          ? "bg-[var(--koluj-green)] text-white"
                          : "bg-[var(--koluj-bg)] text-[var(--koluj-muted)] hover:text-[var(--koluj-green)]"
                      }`}
                    >
                      <span className="block leading-none">
                        {bookingStatusLabels[status]}
                      </span>

                      <span
                        className={`mt-1 block text-xs ${
                          filter === status
                            ? "text-white/80"
                            : "text-[var(--koluj-muted)]"
                        }`}
                      >
                        {statusCounts[status]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 lg:w-[420px]">
                <ViewModeButton
                  label="Vše"
                  active={viewMode === "all"}
                  onClick={() => setViewMode("all")}
                />

                <ViewModeButton
                  label="Půjčuji si"
                  active={viewMode === "borrowing"}
                  onClick={() => setViewMode("borrowing")}
                />

                <ViewModeButton
                  label="Půjčuji ostatním"
                  active={viewMode === "lending"}
                  onClick={() => setViewMode("lending")}
                />
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <BookingsCalendar
                days={calendarDays}
                visibleMonth={visibleMonth}
                todayIso={todayIso}
                activeDate={activeDate}
                bookings={filteredCalendarBookings}
                onActiveDateChange={setActiveDate}
                onPreviousMonth={previousMonth}
                onNextMonth={nextMonth}
              />

              <SelectedDayPanel
                activeDate={activeDate}
                bookings={activeDateBookings}
              />
            </section>

            <section className="mt-6">
              {!showLists ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowLists(true);
                    setVisibleListCount(10);
                  }}
                  className="koluj-button w-full px-6 py-4"
                >
                  Zobrazit seznam rezervací
                </button>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[var(--koluj-muted)]">
                      Zobrazuji prvních {visibleListCount} rezervací podle aktuálních filtrů.
                    </p>

                    <button
                      type="button"
                      onClick={() => setShowLists(false)}
                      className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-[var(--koluj-muted)] hover:text-[var(--koluj-green)]"
                    >
                      Skrýt seznam
                    </button>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    {visibleGroups.map((group) => (
                      <BookingColumn key={group.key} group={group} />
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}


function BookingsCalendar({
  days,
  visibleMonth,
  todayIso,
  activeDate,
  bookings,
  onActiveDateChange,
  onPreviousMonth,
  onNextMonth,
}: {
  days: (Date | null)[];
  visibleMonth: Date;
  todayIso: string;
  activeDate: string;
  bookings: Booking[];
  onActiveDateChange: (date: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}) {
  return (
    <div className="koluj-card overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-[var(--koluj-border)] p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPreviousMonth}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
            aria-label="Předchozí měsíc"
          >
            <ChevronLeft size={24} />
          </button>

          <button
            type="button"
            onClick={onNextMonth}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
            aria-label="Další měsíc"
          >
            <ChevronRight size={24} />
          </button>

          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
              Kalendář rezervací
            </p>
            <h2 className="text-3xl font-black leading-none tracking-tight">
              {monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-bold text-[var(--koluj-muted)]">
          <CalendarLegend className="bg-orange-100" label="Žádost" />
          <CalendarLegend className="bg-blue-100" label="Schváleno" />
          <CalendarLegend className="bg-green-100" label="Probíhá" />
          <CalendarLegend className="bg-stone-200" label="Dokončeno" />
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--koluj-border)] bg-[var(--koluj-bg)] text-center text-xs font-black uppercase text-[var(--koluj-muted)]">
        {dayLabels.map((day) => (
          <div key={day} className="py-3">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-[var(--koluj-border)]">
        {days.map((day, index) => {
          if (!day) {
            return (
              <div
                key={`empty-${index}`}
                className="min-h-[102px] bg-white/35 md:min-h-[136px]"
              />
            );
          }

          const isoDate = toIsoDate(day);
          const isToday = isoDate === todayIso;
          const isActive = isoDate === activeDate;
          const dayBookings = bookings.filter((booking) =>
            isBookingOnDate(booking, isoDate),
          );
          const visibleDayBookings = dayBookings.slice(0, 3);

          return (
            <button
              key={isoDate}
              type="button"
              onClick={() => onActiveDateChange(isoDate)}
              className={`min-h-[102px] bg-white p-2 text-left hover:bg-[var(--koluj-bg)] md:min-h-[136px] md:p-3 ${
                isActive ? "ring-2 ring-inset ring-[var(--koluj-green)]" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${
                    isToday
                      ? "bg-[var(--koluj-green)] text-white"
                      : "text-[var(--koluj-text)]"
                  }`}
                >
                  {day.getDate()}
                </span>

                {dayBookings.length > 0 && (
                  <span className="rounded-full bg-[var(--koluj-bg)] px-2 py-1 text-[10px] font-black text-[var(--koluj-green)]">
                    {dayBookings.length}
                  </span>
                )}
              </div>

              <div className="mt-2 space-y-1">
                {visibleDayBookings.map((booking) => {
                  const displayStatus = getDisplayStatus(booking);

                  return (
                    <div
                      key={booking.id}
                      className={`truncate rounded-full px-2 py-1 text-[10px] font-black leading-none ${
                        displayStatusClasses[displayStatus.key] ||
                        "bg-[var(--koluj-bg)] text-[var(--koluj-muted)]"
                      }`}
                      title={displayStatus.label}
                    >
                      {booking.offers?.title || "Nabídka"}
                    </div>
                  );
                })}

                {dayBookings.length > visibleDayBookings.length && (
                  <div className="truncate rounded-full bg-[var(--koluj-bg)] px-2 py-1 text-[10px] font-black leading-none text-[var(--koluj-muted)]">
                    +{dayBookings.length - visibleDayBookings.length} další
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectedDayPanel({
  activeDate,
  bookings,
}: {
  activeDate: string;
  bookings: Booking[];
}) {
  return (
    <aside className="self-start xl:sticky xl:top-28">
      <div className="koluj-card p-6 md:p-8">
        <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
          Vybraný den
        </p>

        <h2 className="mt-1 text-2xl font-black">
          {parseIsoDate(activeDate).toLocaleDateString("cs-CZ", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h2>

        {bookings.length === 0 ? (
          <div className="mt-5 rounded-3xl bg-[var(--koluj-bg)] p-5 text-sm font-bold text-[var(--koluj-muted)]">
            V tento den nemáš žádnou rezervaci.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {bookings.map((booking) => {
              const displayStatus = getDisplayStatus(booking);

              return (
              <Link
                key={booking.id}
                href={`/dashboard/bookings/${booking.id}`}
                prefetch={false}
                className="block rounded-3xl border border-[var(--koluj-border)] bg-white p-4 transition hover:border-[var(--koluj-green)] hover:shadow-[0_14px_34px_rgba(31,31,26,0.10)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">
                      {booking.offers?.title || "Nabídka"}
                    </p>

                    <p className="mt-1 text-xs font-bold text-[var(--koluj-muted)]">
                      {formatBookingRange(booking)}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                      displayStatusClasses[displayStatus.key] ||
                      "bg-[var(--koluj-bg)] text-[var(--koluj-muted)]"
                    }`}
                  >
                    {displayStatus.label}
                  </span>
                </div>

                <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[var(--koluj-green)]">
                  Otevřít detail
                  <ArrowRight size={15} />
                </p>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function CalendarLegend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--koluj-bg)] px-3 py-2">
      <span className={`h-3 w-3 rounded-full ring-1 ring-black/5 ${className}`} />
      {label}
    </span>
  );
}


function ViewModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-3 text-sm font-black transition ${
        active
          ? "bg-[var(--koluj-green)] text-white shadow-[0_14px_34px_rgba(22,163,74,0.20)]"
          : "bg-white text-[var(--koluj-muted)] hover:text-[var(--koluj-green)]"
      }`}
    >
      {label}
    </button>
  );
}

function BookingColumn({ group }: { group: BookingGroup }) {
  return (
    <section className="koluj-card p-4 md:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-[-0.04em]">
            {group.title}
          </h2>

          <p className="mt-1 text-sm font-bold text-[var(--koluj-muted)]">
            {group.subtitle}
          </p>
        </div>

        <span className="rounded-full bg-[var(--koluj-bg)] px-4 py-2 text-sm font-black text-[var(--koluj-green)]">
          {group.items.length} záznamů
        </span>
      </div>

      <div className="space-y-3">
        {group.items.length === 0 ? (
          <EmptyState text={group.emptyText} />
        ) : (
          group.items.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              mode={group.key}
            />
          ))
        )}

        {group.loadedCount < group.total && (
          <button
            type="button"
            onClick={group.onLoadMore}
            className="koluj-button w-full px-6 py-3"
          >
            Načíst další
          </button>
        )}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[var(--koluj-green)]">
        <Inbox size={26} />
      </span>

      <p className="mt-4 font-black text-[var(--koluj-ink)]">
        Zatím nic k zobrazení
      </p>

      <p className="mt-2 text-sm font-bold text-[var(--koluj-muted)]">
        {text}
      </p>
    </div>
  );
}

function BookingCard({
  booking,
  mode,
}: {
  booking: Booking;
  mode: BookingGroupKey;
}) {
  const personLabel = mode === "borrowing" ? "Vlastník" : "Zájemce";

  const personName =
    mode === "borrowing"
      ? booking.owner?.full_name || "Uživatel"
      : booking.customer?.full_name || "Uživatel";

  const displayStatus = getDisplayStatus(booking);
  const statusClass =
    displayStatusClasses[displayStatus.key] ||
    "bg-[var(--koluj-bg)] text-[var(--koluj-muted)]";

  const icon =
    displayStatus.key === "requested" ? (
      statusIcons.requested
    ) : displayStatus.key === "scheduled" || displayStatus.key === "approved" ? (
      statusIcons.approved
    ) : displayStatus.key === "in_progress" || displayStatus.key === "active" ? (
      statusIcons.active
    ) : displayStatus.key === "completed" || displayStatus.key === "returned" ? (
      statusIcons.returned
    ) : displayStatus.key === "cancelled" ? (
      statusIcons.cancelled
    ) : (
      <Clock3 size={18} />
    );

  return (
    <Link
      href={`/dashboard/bookings/${booking.id}`}
      prefetch={false}
      className="group block rounded-[24px] border border-[var(--koluj-border)] bg-white p-3 transition hover:border-[var(--koluj-green)] hover:shadow-[0_18px_42px_rgba(31,31,26,0.10)]"
    >
      <div className="flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[var(--koluj-bg)]">
          {booking.offers?.primary_image_url ? (
            <Image
              src={booking.offers.primary_image_url}
              alt={booking.offers.title}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--koluj-green)]">
              <Package size={28} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-lg font-black leading-tight">
                {booking.offers?.title || "Nabídka"}
              </p>

              <p className="mt-1 text-sm font-bold text-[var(--koluj-muted)]">
                {personLabel}: {personName}
              </p>
            </div>

            <span
              className={`inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${statusClass}`}
            >
              {icon}
              {displayStatus.label}
            </span>
          </div>

          <BookingRange booking={booking} />
          <BookingDate booking={booking} />

          <p className="mt-4 inline-flex items-center gap-2 font-black text-[var(--koluj-green)]">
            Otevřít
            <ArrowRight
              size={17}
              className="transition group-hover:translate-x-1"
            />
          </p>
        </div>
      </div>
    </Link>
  );
}


function BookingRange({ booking }: { booking: Booking }) {
  const from = getBookingDateFrom(booking);
  const to = getBookingDateTo(booking);

  if (!from) return null;

  return (
    <p className="mt-4 flex items-center gap-2 text-sm font-black text-[var(--koluj-green)]">
      <CalendarDays size={15} />
      Termín: {from === to ? formatBookingRange(booking) : formatBookingRange(booking)}
    </p>
  );
}

function BookingDate({ booking }: { booking: Booking }) {
  const isService = booking.offers?.offer_type === "service";
  const value =
    booking.status === "requested"
      ? booking.created_at
      : booking.status === "approved"
        ? booking.approved_at
        : booking.status === "active"
          ? isService
            ? booking.approved_at
            : booking.handed_over_at
          : booking.status === "returned"
            ? booking.returned_at
            : booking.created_at;

  const label =
    booking.status === "requested"
      ? "Vytvořeno"
      : booking.status === "approved"
        ? "Schváleno"
        : booking.status === "active"
          ? isService
            ? "Schváleno"
            : "Předáno"
          : booking.status === "returned"
            ? isService
              ? "Dokončeno"
              : "Vráceno"
            : "Vytvořeno";

  if (!value) return null;

  return (
    <p className="mt-4 flex items-center gap-2 text-sm font-bold text-[var(--koluj-muted)]">
      <CalendarDays size={15} />
      {label}: {formatDateTime(value)}
    </p>
  );
}
