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
  Info,
  Package,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import BackLink from "@/app/components/BackLink";
import PageLoader from "@/app/components/PageLoader";
import {
  formatDateTime,
  getBookingDisplayStatus,
  getBookingFilterStatus,
  type BookingFilterStatus,
} from "@/lib/format";

type BookingStatus = "all" | BookingFilterStatus;

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
  "scheduled",
  "action_required",
  "in_progress",
  "completed",
  "cancelled",
];

const bookingFilterLabels: Record<BookingStatus, string> = {
  all: "Vše",
  requested: "Čeká na schválení",
  scheduled: "Naplánováno",
  action_required: "Čeká na akci",
  in_progress: "Probíhá",
  completed: "Dokončeno",
  cancelled: "Zrušeno",
};

const statusHelpItems: Array<{
  status: Exclude<BookingStatus, "all">;
  description: string;
}> = [
  {
    status: "requested",
    description: "Majitel ještě rezervaci nepotvrdil.",
  },
  {
    status: "scheduled",
    description: "Rezervace je potvrzená, ale její termín ještě nezačal.",
  },
  {
    status: "action_required",
    description: "Je potřeba potvrdit předání, vrácení nebo dokončení služby.",
  },
  {
    status: "in_progress",
    description: "Věc byla předána nebo právě probíhá objednaná služba.",
  },
  {
    status: "completed",
    description: "Věc byla vrácena nebo byla služba dokončena.",
  },
  {
    status: "cancelled",
    description: "Rezervace byla zrušena a už není aktivní.",
  },
];

const statusIcons: Record<Exclude<BookingStatus, "all">, ReactNode> = {
  requested: <Clock3 size={18} />,
  scheduled: <CheckCircle2 size={18} />,
  action_required: <Clock3 size={18} />,
  in_progress: <Handshake size={18} />,
  completed: <RotateCcw size={18} />,
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
  waiting_pickup: "bg-amber-100 text-amber-800",
  waiting_return: "bg-amber-100 text-amber-800",
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
    dateFrom: booking.date_from,
    dateTo: booking.date_to,
  });
}

function getFilterStatus(booking: Booking): BookingFilterStatus {
  return getBookingFilterStatus({
    status: booking.status,
    offerType: booking.offers?.offer_type,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    dateFrom: booking.date_from,
    dateTo: booking.date_to,
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
  const [showStatusHelp, setShowStatusHelp] = useState(false);
  const [showLists, setShowLists] = useState(false);
  const [visibleListCount, setVisibleListCount] = useState(10);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [activeDate, setActiveDate] = useState(() => toIsoDate(new Date()));

  const [borrowingPage] = useState(1);
  const [lendingPage] = useState(1);

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
      scheduled: 0,
      action_required: 0,
      in_progress: 0,
      completed: 0,
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
              <div className="koluj-card p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="booking-status-filter"
                    className="block text-sm font-black text-[var(--koluj-text)]"
                  >
                    Stav rezervace
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowStatusHelp(true)}
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-black text-[var(--koluj-green)] transition hover:bg-[var(--koluj-bg)]"
                    aria-label="Zobrazit význam stavů rezervace"
                  >
                    <Info size={16} />
                    Význam stavů
                  </button>
                </div>
                <select
                  id="booking-status-filter"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as BookingStatus)}
                  className="w-full rounded-2xl border border-[var(--koluj-border)] bg-white px-4 py-3 font-bold text-[var(--koluj-text)] outline-none transition focus:border-[var(--koluj-green)] focus:ring-2 focus:ring-[var(--koluj-green)]/20 lg:min-w-[280px]"
                >
                  {bookingStatuses.map((status) => (
                    <option key={status} value={status}>
                      {bookingFilterLabels[status]} ({statusCounts[status]})
                    </option>
                  ))}
                </select>
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

      {showStatusHelp && (
        <StatusHelpDialog onClose={() => setShowStatusHelp(false)} />
      )}
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
          <CalendarLegend className="bg-orange-100" label="Čeká na schválení" />
          <CalendarLegend className="bg-blue-100" label="Naplánováno" />
          <CalendarLegend className="bg-amber-100" label="Čeká na akci" />
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


function StatusHelpDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-status-help-title"
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-[32px] bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-[32px] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
              Nápověda
            </p>
            <h2 id="booking-status-help-title" className="mt-1 text-2xl font-black">
              Význam stavů
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-text)]"
            aria-label="Zavřít nápovědu"
          >
            <X size={21} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {statusHelpItems.map((item) => (
            <div
              key={item.status}
              className="rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-4"
            >
              <p className="font-black text-[var(--koluj-text)]">
                {bookingFilterLabels[item.status]}
              </p>
              <p className="mt-1 text-sm font-bold leading-relaxed text-[var(--koluj-muted)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <button type="button" onClick={onClose} className="koluj-button mt-5 w-full px-6 py-3">
          Rozumím
        </button>
      </section>
    </div>
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

  const filterStatus = getFilterStatus(booking);
  const icon = statusIcons[filterStatus];

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
        ? "Potvrzeno"
        : booking.status === "active"
          ? isService
            ? "Potvrzeno"
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
