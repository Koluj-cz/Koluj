"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import BackLink from "@/app/components/BackLink";
import { supabase } from "@/lib/supabase";
import PageLoader from "@/app/components/PageLoader";
import {
  bookingStatusLabels,
  bookingStatusClasses,
} from "@/lib/constants";

import {
  formatDateTime,
} from "@/lib/format";

type BookingStatus =
  | "all"
  | "requested"
  | "approved"
  | "active"
  | "returned"
  | "cancelled";

type MobileMode = "borrowing" | "lending";

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

const PAGE_SIZE = 10;

export default function BookingsPage() {
  const [borrowing, setBorrowing] = useState<Booking[]>([]);
  const [lending, setLending] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus>("all");
  const [mobileMode, setMobileMode] = useState<MobileMode>("borrowing");

  const [borrowingPage, setBorrowingPage] = useState(1);
  const [lendingPage, setLendingPage] = useState(1);
  const [borrowingTotal, setBorrowingTotal] = useState(0);
  const [lendingTotal, setLendingTotal] = useState(0);

  useEffect(() => {
    loadBookings();
  }, [borrowingPage, lendingPage]);

  async function loadBookings() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const selectQuery = `
      *,
      offers:offers (
        id,
        title,
        primary_image_url
      ),
      owner:profiles!bookings_owner_id_fkey (
        full_name
      ),
      customer:profiles!bookings_customer_id_fkey (
        full_name
      )
    `;

    const borrowingQuery = supabase
      .from("bookings")
      .select(selectQuery, { count: "exact" })
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .range(0, borrowingPage * PAGE_SIZE - 1);

    const lendingQuery = supabase
      .from("bookings")
      .select(selectQuery, { count: "exact" })
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .range(0, lendingPage * PAGE_SIZE - 1);

    const { data: borrowingData, count: borrowingCount } = await borrowingQuery;
    const { data: lendingData, count: lendingCount } = await lendingQuery;

    setBorrowing((borrowingData || []) as Booking[]);
    setLending((lendingData || []) as Booking[]);
    setBorrowingTotal(borrowingCount || 0);
    setLendingTotal(lendingCount || 0);
    setLoading(false);
  }

  const filteredBorrowing = useMemo(() => {
    if (filter === "all") return borrowing;
    return borrowing.filter((booking) => booking.status === filter);
  }, [borrowing, filter]);

  const filteredLending = useMemo(() => {
    if (filter === "all") return lending;
    return lending.filter((booking) => booking.status === filter);
  }, [lending, filter]);

  return (
    <main className="min-h-screen">
      <div className="koluj-shell">
        <header className="mb-10">
          <BackLink href="/dashboard">Dashboard</BackLink>
        </header>

        <div>
          <h1 className="koluj-heading">Rezervace</h1>

          <p className="mt-4 text-lg text-[var(--koluj-muted)]">
            Přehled nabídek, které si rezervuješ nebo rezervuješ ostatním.
          </p>
        </div>

        <section className="koluj-card mt-10 p-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(bookingStatusLabels) as BookingStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                  filter === status
                    ? "bg-[var(--koluj-green)] text-white"
                    : "bg-[var(--koluj-bg)] text-[var(--koluj-muted)] hover:text-[var(--koluj-green)]"
                }`}
              >
                {bookingStatusLabels[status]}
              </button>
            ))}
          </div>
        </section>

        {!loading && (
          <div className="mt-8 grid grid-cols-2 gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMode("borrowing")}
              className={`rounded-2xl px-4 py-3 font-black transition ${
                mobileMode === "borrowing"
                  ? "bg-[var(--koluj-green)] text-white"
                  : "bg-white text-[var(--koluj-muted)]"
              }`}
            >
              Půjčuji si
            </button>

            <button
              type="button"
              onClick={() => setMobileMode("lending")}
              className={`rounded-2xl px-4 py-3 font-black transition ${
                mobileMode === "lending"
                  ? "bg-[var(--koluj-green)] text-white"
                  : "bg-white text-[var(--koluj-muted)]"
              }`}
            >
              Půjčuji ostatním
            </button>
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : (
          <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-2">
            <section
              className={
                mobileMode === "borrowing" ? "block" : "hidden lg:block"
              }
            >
              <SectionHeader title="Půjčuji si" count={filteredBorrowing.length} />

              <div className="space-y-4">
                {filteredBorrowing.length === 0 ? (
                  <div className="koluj-card p-6 text-[var(--koluj-muted)]">
                    Žádné rezervace pro vybraný filtr.
                  </div>
                ) : (
                  filteredBorrowing.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} mode="borrowing" />
                  ))
                )}

                {borrowing.length < borrowingTotal && (
                  <button
                    type="button"
                    onClick={() => setBorrowingPage((page) => page + 1)}
                    className="koluj-button w-full px-6 py-3"
                  >
                    Načíst další
                  </button>
                )}
              </div>
            </section>

            <section
              className={
                mobileMode === "lending" ? "block" : "hidden lg:block"
              }
            >
              <SectionHeader
                title="Půjčuji ostatním"
                count={filteredLending.length}
              />

              <div className="space-y-4">
                {filteredLending.length === 0 ? (
                  <div className="koluj-card p-6 text-[var(--koluj-muted)]">
                    Žádné rezervace pro vybraný filtr.
                  </div>
                ) : (
                  filteredLending.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} mode="lending" />
                  ))
                )}

                {lending.length < lendingTotal && (
                  <button
                    type="button"
                    onClick={() => setLendingPage((page) => page + 1)}
                    className="koluj-button w-full px-6 py-3"
                  >
                    Načíst další
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-[var(--koluj-muted)]">
          {count} {count === 1 ? "záznam" : "záznamů"}
        </p>
      </div>
    </div>
  );
}

function BookingCard({
  booking,
  mode,
}: {
  booking: Booking;
  mode: "borrowing" | "lending";
}) {
  const personLabel = mode === "borrowing" ? "Vlastník" : "Zájemce";

  const personName =
    mode === "borrowing"
      ? booking.owner?.full_name || "Uživatel"
      : booking.customer?.full_name || "Uživatel";

  const statusClass =
    bookingStatusClasses[booking.status] ||
    "bg-[var(--koluj-bg)] text-[var(--koluj-muted)]";

  return (
    <Link
      href={`/dashboard/bookings/${booking.id}`}
      className="koluj-card block p-4 transition hover:-translate-y-1"
    >
      <div className="flex gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[var(--koluj-bg)]">
          {booking.offers?.primary_image_url ? (
            <img
              src={booking.offers.primary_image_url}
              alt={booking.offers.title}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-black">
                  {booking.offers?.title || "Nabídka"}
                </p>

                <p className="mt-1 text-sm text-[var(--koluj-muted)]">
                  {personLabel}: {personName}
                </p>
              </div>

              <span
                className={`inline-flex max-w-full shrink-0 rounded-full px-3 py-1 text-xs font-black ${statusClass}`}
              >
                {bookingStatusLabels[booking.status] || booking.status}
              </span>
            </div>
          </div>

          <div className="mt-4 text-sm text-[var(--koluj-muted)]">
            {booking.status === "requested" && (
              <p className="flex items-center gap-2">
                <CalendarDays size={15} />
                Vytvořeno: {formatDateTime(booking.created_at)}
              </p>
            )}

            {booking.status === "approved" && booking.approved_at && (
              <p className="flex items-center gap-2">
                <CalendarDays size={15} />
                Schváleno: {formatDateTime(booking.approved_at)}
              </p>
            )}

            {booking.status === "active" && booking.handed_over_at && (
              <p className="flex items-center gap-2">
                <CalendarDays size={15} />
                Předáno: {formatDateTime(booking.handed_over_at)}
              </p>
            )}

            {booking.status === "returned" && booking.returned_at && (
              <p className="flex items-center gap-2">
                <CalendarDays size={15} />
                Vráceno: {formatDateTime(booking.returned_at)}
              </p>
            )}
          </div>

          <p className="mt-4 font-black text-[var(--koluj-green)]">
            Otevřít →
          </p>
        </div>
      </div>
    </Link>
  );
}