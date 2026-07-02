"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

type Reservation = {
  id: string;
  booking_id: string;
  date_from: string;
  date_to: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
};

type Block = {
  id: string;
  date_from: string;
  date_to: string;
  starts_at: string | null;
  ends_at: string | null;
  reason: string | null;
};

type SelectedRange = {
  dateFrom: string;
  dateTo: string;
};

type SelectedSlot = {
  startsAt: string;
  endsAt: string;
};

type AvailabilityCalendarProps = {
  offerId: string;
  offerType?: string | null;
  isOwner?: boolean;
  selectedRange?: SelectedRange | null;
  selectedSlot?: SelectedSlot | null;
  onRangeChange?: (range: SelectedRange | null) => void;
  onSlotChange?: (slot: SelectedSlot | null) => void;
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
const SERVICE_START_HOUR = 8;
const SERVICE_END_HOUR = 20;
const SERVICE_STEP_MINUTES = 30;

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

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSlot(slot: SelectedSlot) {
  return `${formatShortDate(toIsoDate(new Date(slot.startsAt)))} · ${formatTime(
    slot.startsAt
  )}–${formatTime(slot.endsAt)}`;
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

function timeOptions() {
  const options: string[] = [];
  const start = SERVICE_START_HOUR * 60;
  const end = SERVICE_END_HOUR * 60;

  for (let minutes = start; minutes <= end; minutes += SERVICE_STEP_MINUTES) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  return options;
}

const serviceTimeOptions = timeOptions();

function makeLocalDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function timeFromIso(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function minutesFromTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

export default function AvailabilityCalendar({
  offerId,
  offerType = "item",
  isOwner = false,
  selectedRange,
  selectedSlot,
  onRangeChange,
  onSlotChange,
}: AvailabilityCalendarProps) {
  const isService = offerType === "service";

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedServiceDate, setSelectedServiceDate] = useState(() => toIsoDate(new Date()));
  const [serviceStartTime, setServiceStartTime] = useState("");
  const [serviceEndTime, setServiceEndTime] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBlock, setSavingBlock] = useState(false);
  const [reason, setReason] = useState("");

  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);

  const firstVisibleDate = toIsoDate(
    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  );
  const lastVisibleDate = toIsoDate(
    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0)
  );

  useEffect(() => {
    loadAvailability();
  }, [offerId, firstVisibleDate, lastVisibleDate]);

  useEffect(() => {
    if (selectedSlot?.startsAt && selectedSlot?.endsAt) {
      setSelectedServiceDate(toIsoDate(new Date(selectedSlot.startsAt)));
      setServiceStartTime(timeFromIso(selectedSlot.startsAt));
      setServiceEndTime(timeFromIso(selectedSlot.endsAt));
      return;
    }

    setServiceStartTime("");
    setServiceEndTime("");
  }, [selectedSlot?.startsAt, selectedSlot?.endsAt]);

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

    reservations
      .filter((reservation) => !reservation.starts_at || !isService)
      .forEach((reservation) => {
        eachDateInRange(reservation.date_from, reservation.date_to).forEach((date) => dates.add(date));
      });

    return dates;
  }, [reservations, isService]);

  const blockDates = useMemo(() => {
    const dates = new Set<string>();

    blocks
      .filter((block) => !block.starts_at || !isService)
      .forEach((block) => {
        eachDateInRange(block.date_from, block.date_to).forEach((date) => dates.add(date));
      });

    return dates;
  }, [blocks, isService]);

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

  function hasBusyServiceSlot(slot: SelectedSlot) {
    return (
      reservations.some((reservation) => {
        if (reservation.starts_at && reservation.ends_at) {
          return overlaps(slot.startsAt, slot.endsAt, reservation.starts_at, reservation.ends_at);
        }

        return reservation.date_from <= selectedServiceDate && reservation.date_to >= selectedServiceDate;
      }) ||
      blocks.some((block) => {
        if (block.starts_at && block.ends_at) {
          return overlaps(slot.startsAt, slot.endsAt, block.starts_at, block.ends_at);
        }

        return block.date_from <= selectedServiceDate && block.date_to >= selectedServiceDate;
      })
    );
  }

  function updateServiceSlot(nextStartTime: string, nextEndTime: string) {
    setServiceStartTime(nextStartTime);
    setServiceEndTime(nextEndTime);

    if (!nextStartTime || !nextEndTime) {
      onSlotChange?.(null);
      return;
    }

    if (minutesFromTime(nextEndTime) <= minutesFromTime(nextStartTime)) {
      onSlotChange?.(null);
      return;
    }

    const slot = {
      startsAt: makeLocalDateTime(selectedServiceDate, nextStartTime),
      endsAt: makeLocalDateTime(selectedServiceDate, nextEndTime),
    };

    if (new Date(slot.startsAt) < new Date()) {
      toast.error("Začátek služby nemůže být v minulosti.");
      onSlotChange?.(null);
      return;
    }

    if (hasBusyServiceSlot(slot)) {
      toast.error("Vybraný čas obsahuje obsazený nebo blokovaný interval.");
      onSlotChange?.(null);
      return;
    }

    onSlotChange?.(slot);
  }

  function handleDayClick(date: string) {
    if (isService) {
      setSelectedServiceDate(date);
      setServiceStartTime("");
      setServiceEndTime("");
      onSlotChange?.(null);
      return;
    }

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
    if (savingBlock) return;

    const body = isService
      ? {
          startsAt: selectedSlot?.startsAt,
          endsAt: selectedSlot?.endsAt,
          reason,
        }
      : {
          dateFrom: selectedRange?.dateFrom,
          dateTo: selectedRange?.dateTo,
          reason,
        };

    if (isService && (!selectedSlot?.startsAt || !selectedSlot?.endsAt)) return;
    if (!isService && (!selectedRange?.dateFrom || !selectedRange?.dateTo)) return;

    setSavingBlock(true);

    const response = await fetch(`/api/offers/${offerId}/availability/block`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json().catch(() => null);

    setSavingBlock(false);

    if (!response.ok) {
      toast.error(result?.error || "Blokaci se nepodařilo vytvořit");
      return;
    }

    toast.success(isService ? "Čas byl zablokován" : "Termín byl zablokován");
    setReason("");
    setServiceStartTime("");
    setServiceEndTime("");
    onRangeChange?.(null);
    onSlotChange?.(null);
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
  const validServiceSlot = Boolean(selectedSlot?.startsAt && selectedSlot?.endsAt);

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
            {isService ? "Dostupné časy" : "Dostupnost"}
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
          const reserved = !isService && reservationDates.has(isoDate);
          const blocked = !isService && blockDates.has(isoDate);
          const selected = isService ? selectedServiceDate === isoDate : selectedDates.has(isoDate);
          const isPast = isoDate < todayIso;
          const disabled = !isService && (reserved || blocked || isPast);

          let className = "bg-white text-[var(--koluj-text)] hover:bg-white/80";

          if (selected) {
            className = isService
              ? "bg-[var(--koluj-green)] text-white"
              : "bg-orange-100 text-orange-900 ring-2 ring-orange-300";
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

      {isService && (
        <div className="mt-5 rounded-3xl bg-white p-4">
          <p className="text-sm font-black text-[var(--koluj-muted)]">
            Vyber čas služby · {formatShortDate(selectedServiceDate)}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
              Začátek
              <select
                value={serviceStartTime}
                onChange={(event) => updateServiceSlot(event.target.value, serviceEndTime)}
                className="koluj-input bg-white"
              >
                <option value="">Vyber začátek</option>
                {serviceTimeOptions.slice(0, -1).map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">
              Konec
              <select
                value={serviceEndTime}
                onChange={(event) => updateServiceSlot(serviceStartTime, event.target.value)}
                className="koluj-input bg-white"
              >
                <option value="">Vyber konec</option>
                {serviceTimeOptions.slice(1).map((time) => (
                  <option key={time} value={time} disabled={serviceStartTime ? minutesFromTime(time) <= minutesFromTime(serviceStartTime) : false}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-3 text-xs font-bold text-[var(--koluj-muted)]">
            Časy jsou po 30 minutách. Vybraný rozsah nesmí zasahovat do obsazeného nebo blokovaného času.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--koluj-muted)]">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-white" /> Volné</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-100" /> Rezervováno</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-stone-200" /> Blokováno</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-orange-100" /> Vybráno</span>
      </div>

      {selectedRange?.dateFrom && selectedRange?.dateTo && !isService && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-[var(--koluj-muted)]">
          Vybraný termín: <span className="font-black text-[var(--koluj-text)]">{formatShortDate(selectedRange.dateFrom)} – {formatShortDate(selectedRange.dateTo)}</span>
        </div>
      )}

      {validServiceSlot && selectedSlot && isService && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-[var(--koluj-muted)]">
          Vybraný čas: <span className="font-black text-[var(--koluj-text)]">{formatSlot(selectedSlot)}</span>
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
            disabled={
              savingBlock ||
              (isService
                ? !selectedSlot?.startsAt || !selectedSlot?.endsAt
                : !selectedRange?.dateFrom || !selectedRange?.dateTo)
            }
            className="koluj-button w-full px-5 py-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingBlock
              ? "Ukládám..."
              : isService
              ? "Blokovat vybraný čas"
              : "Blokovat vybraný termín"}
          </button>

          {blocks.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-black text-[var(--koluj-muted)]">Blokace v tomto měsíci</p>
              {blocks.map((block) => (
                <div key={block.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm font-bold">
                  <span>
                    {block.starts_at && block.ends_at
                      ? `${formatShortDate(block.date_from)} · ${formatTime(block.starts_at)}–${formatTime(block.ends_at)}`
                      : `${formatShortDate(block.date_from)} – ${formatShortDate(block.date_to)}`}
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
