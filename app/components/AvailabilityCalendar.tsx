"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

type Reservation = {
  id: string;
  booking_id: string;
  date_from: string;
  date_to: string;
  status: string;
};

type Block = {
  id: string;
  date_from: string;
  date_to: string;
  reason: string | null;
};

type SelectedRange = {
  dateFrom: string;
  dateTo: string;
};

type AvailabilityCalendarProps = {
  offerId: string;
  isOwner?: boolean;
  selectedRange?: SelectedRange | null;
  onRangeChange?: (range: SelectedRange | null) => void;
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
  const days: (Date | null)[] = Array.from({ length: leadingEmptyDays }, () => null);

  for (let day = 1; day <= last.getDate(); day++) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

export default function AvailabilityCalendar({
  offerId,
  isOwner = false,
  selectedRange,
  onRangeChange,
}: AvailabilityCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBlock, setSavingBlock] = useState(false);
  const [reason, setReason] = useState("");

  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);

  const firstVisibleDate = toIsoDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1));
  const lastVisibleDate = toIsoDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0));

  useEffect(() => {
    loadAvailability();
  }, [offerId, firstVisibleDate, lastVisibleDate]);

  async function loadAvailability() {
    setLoading(true);

    const params = new URLSearchParams({
      dateFrom: firstVisibleDate,
      dateTo: lastVisibleDate,
    });

    const response = await fetch(`/api/offers/${offerId}/availability?${params.toString()}`);
    const result = await response.json().catch(() => null);

    setLoading(false);

    if (!response.ok) {
      toast.error(result?.error || "Dostupnost se nepodařilo načíst");
      return;
    }

    setReservations(result.reservations || []);
    setBlocks(result.blocks || []);
  }

  const reservationDates = useMemo(() => {
    const dates = new Set<string>();

    reservations.forEach((reservation) => {
      eachDateInRange(reservation.date_from, reservation.date_to).forEach((date) => dates.add(date));
    });

    return dates;
  }, [reservations]);

  const blockDates = useMemo(() => {
    const dates = new Set<string>();

    blocks.forEach((block) => {
      eachDateInRange(block.date_from, block.date_to).forEach((date) => dates.add(date));
    });

    return dates;
  }, [blocks]);

  const selectedDates = useMemo(() => {
    const dates = new Set<string>();

    if (selectedRange?.dateFrom && selectedRange?.dateTo) {
      eachDateInRange(selectedRange.dateFrom, selectedRange.dateTo).forEach((date) => dates.add(date));
    }

    return dates;
  }, [selectedRange]);

  function isBlocked(date: string) {
    return reservationDates.has(date) || blockDates.has(date);
  }

  function handleDayClick(date: string) {
    if (isBlocked(date)) return;

    if (
      !selectedRange?.dateFrom ||
      (selectedRange.dateTo && selectedRange.dateTo !== selectedRange.dateFrom)
    ) {
      onRangeChange?.({ dateFrom: date, dateTo: date });
      return;
    }

    if (date < selectedRange.dateFrom) {
      onRangeChange?.({ dateFrom: date, dateTo: selectedRange.dateFrom });
      return;
    }

    const rangeDates = eachDateInRange(selectedRange.dateFrom, date);
    const rangeTouchesBlockedDay = rangeDates.some((rangeDate) => isBlocked(rangeDate));

    if (rangeTouchesBlockedDay) {
      toast.error("Vybraný rozsah obsahuje obsazený nebo blokovaný den.");
      onRangeChange?.({ dateFrom: date, dateTo: date });
      return;
    }

    onRangeChange?.({ dateFrom: selectedRange.dateFrom, dateTo: date });
  }

  async function createBlock() {
    if (!selectedRange?.dateFrom || !selectedRange?.dateTo || savingBlock) return;

    setSavingBlock(true);

    const response = await fetch(`/api/offers/${offerId}/availability/block`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: selectedRange.dateFrom,
        dateTo: selectedRange.dateTo,
        reason,
      }),
    });

    const result = await response.json().catch(() => null);

    setSavingBlock(false);

    if (!response.ok) {
      toast.error(result?.error || "Blokaci se nepodařilo vytvořit");
      return;
    }

    toast.success("Termín byl zablokován");
    setReason("");
    onRangeChange?.(null);
    loadAvailability();
  }

  async function deleteBlock(blockId: string) {
    const response = await fetch(`/api/offers/${offerId}/availability/block/${blockId}`, {
      method: "DELETE",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(result?.error || "Blokaci se nepodařilo zrušit");
      return;
    }

    toast.success("Termín byl uvolněn");
    loadAvailability();
  }

  function previousMonth() {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  function nextMonth() {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  const todayIso = toIsoDate(new Date());

  return (
    <div className="rounded-[28px] bg-[var(--koluj-bg)] p-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={previousMonth}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--koluj-green)] shadow-sm"
          aria-label="Předchozí měsíc"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
            Dostupnost
          </p>
          <p className="text-xl font-black">
            {monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
          </p>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--koluj-green)] shadow-sm"
          aria-label="Další měsíc"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-[var(--koluj-muted)]">
        {dayLabels.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const isoDate = toIsoDate(day);
          const reserved = reservationDates.has(isoDate);
          const blocked = blockDates.has(isoDate);
          const selected = selectedDates.has(isoDate);
          const isPast = isoDate < todayIso;
          const disabled = reserved || blocked || isPast;

          let className = "bg-white text-[var(--koluj-text)] hover:bg-white/80";

          if (selected) {
            className = "bg-orange-100 text-orange-900 ring-2 ring-orange-300";
          } else if (reserved) {
            className = "bg-red-100 text-red-700 cursor-not-allowed";
          } else if (blocked) {
            className = "bg-stone-200 text-stone-500 cursor-not-allowed";
          } else if (isPast) {
            className = "bg-white/50 text-stone-300 cursor-not-allowed";
          }

          return (
            <button
              key={isoDate}
              type="button"
              disabled={disabled}
              onClick={() => handleDayClick(isoDate)}
              className={`aspect-square rounded-2xl text-sm font-black transition ${className}`}
              title={
                reserved
                  ? "Rezervováno"
                  : blocked
                  ? "Blokováno vlastníkem"
                  : isPast
                  ? "Minulý den"
                  : "Volné"
              }
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--koluj-muted)]">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-white" /> Volné</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-100" /> Rezervováno</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-stone-200" /> Blokováno</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-orange-100" /> Vybráno</span>
      </div>

      {selectedRange?.dateFrom && selectedRange?.dateTo && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-[var(--koluj-muted)]">
          Vybraný termín: <span className="font-black text-[var(--koluj-text)]">{formatShortDate(selectedRange.dateFrom)} – {formatShortDate(selectedRange.dateTo)}</span>
        </div>
      )}

      {isOwner && (
        <div className="mt-4 space-y-3">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Poznámka k blokaci (volitelné)"
            className="koluj-input bg-white"
          />

          <button
            type="button"
            onClick={createBlock}
            disabled={!selectedRange?.dateFrom || !selectedRange?.dateTo || savingBlock}
            className="koluj-button w-full px-5 py-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingBlock ? "Ukládám..." : "Blokovat vybraný termín"}
          </button>

          {blocks.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-black text-[var(--koluj-muted)]">Blokace v tomto měsíci</p>
              {blocks.map((block) => (
                <div key={block.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm font-bold">
                  <span>
                    {formatShortDate(block.date_from)} – {formatShortDate(block.date_to)}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteBlock(block.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600"
                    aria-label="Uvolnit termín"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <p className="mt-3 text-center text-sm font-bold text-[var(--koluj-muted)]">
          Načítám dostupnost...
        </p>
      )}
    </div>
  );
}
