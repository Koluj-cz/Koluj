"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
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
import {
  bookingStatusClasses,
  bookingStatusLabels,
} from "@/lib/constants";
import { formatDateTime, translateBookingStatus } from "@/lib/format";

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
  owner_id: string | null;
  customer_id: string | null;
  owner: { full_name: string | null } | null;
  customer: { full_name: string | null } | null;
  offers: {
    id: string;
    title: string;
    primary_image_url: string | null;
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

export default function BookingsPage() {
  const [borrowing, setBorrowing] = useState<Booking[]>([]);
  const [lending, setLending] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  const [borrowingPage, setBorrowingPage] = useState(1);
  const [lendingPage, setLendingPage] = useState(1);
  const [borrowingTotal, setBorrowingTotal] = useState(0);
  const [lendingTotal, setLendingTotal] = useState(0);

  useEffect(() => {
    loadBookings();
  }, [borrowingPage, lendingPage]);

  async function loadBookings() {
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
  }

  const allBookings = useMemo(
    () => [...borrowing, ...lending],
    [borrowing, lending],
  );

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
      if (booking.status in counts) {
        counts[booking.status as BookingStatus] += 1;
      }
    });

    return counts;
  }, [allBookings]);

  const filteredBorrowing = useMemo(() => {
    if (filter === "all") return borrowing;
    return borrowing.filter((booking) => booking.status === filter);
  }, [borrowing, filter]);

  const filteredLending = useMemo(() => {
    if (filter === "all") return lending;
    return lending.filter((booking) => booking.status === filter);
  }, [lending, filter]);

  const bookingGroups: BookingGroup[] = [
    {
      key: "borrowing",
      title: "Půjčuji si",
      subtitle: "Rezervace, které řešíš jako zájemce.",
      emptyText: "Žádné rezervace pro vybraný filtr.",
      items: filteredBorrowing,
      loadedCount: borrowing.length,
      total: borrowingTotal,
      onLoadMore: () => setBorrowingPage((page) => page + 1),
    },
    {
      key: "lending",
      title: "Půjčuji ostatním",
      subtitle: "Žádosti a rezervace k tvým nabídkám.",
      emptyText: "Žádné rezervace pro vybraný filtr.",
      items: filteredLending,
      loadedCount: lending.length,
      total: lendingTotal,
      onLoadMore: () => setLendingPage((page) => page + 1),
    },
  ];

  const visibleGroups = bookingGroups.filter(
    (group) => viewMode === "all" || viewMode === group.key,
  );

  const waitingCount = statusCounts.requested + statusCounts.approved;

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackLink href="/dashboard">Dashboard</BackLink>

            {!loading && (
              <span className="koluj-header-button pointer-events-none">
                <Package size={17} />
                {borrowingTotal + lendingTotal} celkem
              </span>
            )}
          </div>

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
                Můj prostor
              </p>

              <h1 className="koluj-heading mt-3">Rezervace</h1>

              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--koluj-muted)] md:text-xl">
                Přehled žádostí, probíhajících půjčení a historie. Nahoře hned
                vidíš, co čeká na reakci.
              </p>
            </div>

            {!loading && (
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryCard
                  title="Čeká na řešení"
                  value={waitingCount}
                  text={`${bookingStatusLabels.requested} + ${bookingStatusLabels.approved}`}
                  icon={<Clock3 size={24} />}
                  active={waitingCount > 0}
                />

                <SummaryCard
                  title={bookingStatusLabels.active}
                  value={statusCounts.active}
                  text="Aktuálně probíhající rezervace"
                  icon={<Handshake size={24} />}
                  active={statusCounts.active > 0}
                />

                <SummaryCard
                  title={bookingStatusLabels.returned}
                  value={statusCounts.returned}
                  text="Dokončené rezervace"
                  icon={<RotateCcw size={24} />}
                />

                <SummaryCard
                  title={bookingStatusLabels.cancelled}
                  value={statusCounts.cancelled}
                  text="Zrušené žádosti a rezervace"
                  icon={<XCircle size={24} />}
                />
              </div>
            )}
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

            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              {visibleGroups.map((group) => (
                <BookingColumn key={group.key} group={group} />
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  text,
  icon,
  active = false,
}: {
  title: string;
  value: number;
  text: string;
  icon: ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-[26px] border p-5 ${
        active
          ? "border-[var(--koluj-green)] bg-white shadow-[0_18px_42px_rgba(22,163,74,0.14)]"
          : "border-[var(--koluj-border)] bg-white/76"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[var(--koluj-muted)]">
            {title}
          </p>

          <p className="mt-2 text-4xl font-black tracking-[-0.05em] text-[var(--koluj-ink)]">
            {value}
          </p>
        </div>

        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            active
              ? "bg-[var(--koluj-green)] text-white"
              : "bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
          }`}
        >
          {icon}
        </span>
      </div>

      <p className="mt-3 text-sm font-bold leading-relaxed text-[var(--koluj-muted)]">
        {text}
      </p>
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

  const statusClass =
    bookingStatusClasses[booking.status] ||
    "bg-[var(--koluj-bg)] text-[var(--koluj-muted)]";

  const icon =
    booking.status === "requested" ||
    booking.status === "approved" ||
    booking.status === "active" ||
    booking.status === "returned" ||
    booking.status === "cancelled" ? (
      statusIcons[booking.status]
    ) : (
      <CalendarDays size={18} />
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
              {translateBookingStatus(booking.status)}
            </span>
          </div>

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

function BookingDate({ booking }: { booking: Booking }) {
  const value =
    booking.status === "requested"
      ? booking.created_at
      : booking.status === "approved"
        ? booking.approved_at
        : booking.status === "active"
          ? booking.handed_over_at
          : booking.status === "returned"
            ? booking.returned_at
            : booking.created_at;

  const label =
    booking.status === "requested"
      ? "Vytvořeno"
      : booking.status === "approved"
        ? "Schváleno"
        : booking.status === "active"
          ? "Předáno"
          : booking.status === "returned"
            ? "Vráceno"
            : "Vytvořeno";

  if (!value) return null;

  return (
    <p className="mt-4 flex items-center gap-2 text-sm font-bold text-[var(--koluj-muted)]">
      <CalendarDays size={15} />
      {label}: {formatDateTime(value)}
    </p>
  );
}
