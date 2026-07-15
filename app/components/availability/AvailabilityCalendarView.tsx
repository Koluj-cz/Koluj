"use client";

import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { getServiceHoursForDate } from "@/lib/serviceBookingRules";
import type { Block, SelectedRange, SelectedSlot } from "./types";
import { dayLabels, formatShortDate, formatTime, monthNames, toIsoDate } from "./utils";

type Props = {
  visibleMonth: Date;
  days: (Date | null)[];
  isService: boolean;
  isDeadlineService: boolean;
  isScheduledService: boolean;
  selectedServiceDate: string;
  selectedRange?: SelectedRange | null;
  selectedSlot?: SelectedSlot | null;
  reservationDates: Set<string>;
  blockDates: Set<string>;
  selectedDates: Set<string>;
  serviceBookingMode: string | null;
  serviceHoursMode: string | null;
  weekdayStartTime: string | null;
  weekdayEndTime: string | null;
  weekendStartTime: string | null;
  weekendEndTime: string | null;
  serviceStartTime: string;
  serviceEndTime: string;
  availableServiceStartTimes: string[];
  availableServiceEndTimes: string[];
  isOwner: boolean;
  reason: string;
  savingBlock: boolean;
  blocks: Block[];
  loading: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onDayClick: (date: string) => void;
  onServiceSlotChange: (start: string, end: string) => void;
  onReasonChange: (value: string) => void;
  onCreateBlock: () => void;
  onDeleteBlock: (id: string) => void;
};

export default function AvailabilityCalendarView(props: Props) {
  const todayIso = toIsoDate(new Date());
  return (
    <div className="rounded-[28px] bg-[var(--koluj-bg)] p-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={props.onPreviousMonth} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--koluj-green)] shadow-sm" aria-label="Předchozí měsíc"><ChevronLeft size={20} /></button>
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">{props.isDeadlineService ? "Termín dokončení" : props.isService ? "Dostupné časy" : "Dostupnost"}</p>
          <p className="text-xl font-black">{monthNames[props.visibleMonth.getMonth()]} {props.visibleMonth.getFullYear()}</p>
        </div>
        <button type="button" onClick={props.onNextMonth} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--koluj-green)] shadow-sm" aria-label="Další měsíc"><ChevronRight size={20} /></button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-[var(--koluj-muted)]">{dayLabels.map((day) => <div key={day}>{day}</div>)}</div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {props.days.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="aspect-square" />;
          const isoDate = toIsoDate(day);
          const reserved = !props.isService && props.reservationDates.has(isoDate);
          const blocked = props.isDeadlineService ? props.blockDates.has(isoDate) : !props.isService && props.blockDates.has(isoDate);
          const selected = props.isService ? props.selectedServiceDate === isoDate : props.selectedDates.has(isoDate);
          const isPast = isoDate < todayIso;
          const hasServiceHours = !props.isScheduledService || Boolean(getServiceHoursForDate({
            service_booking_mode: props.serviceBookingMode, service_hours_mode: props.serviceHoursMode,
            weekday_start_time: props.weekdayStartTime, weekday_end_time: props.weekdayEndTime,
            weekend_start_time: props.weekendStartTime, weekend_end_time: props.weekendEndTime,
          }, isoDate));
          const disabled = props.isDeadlineService ? blocked || isPast : props.isScheduledService ? isPast || !hasServiceHours : reserved || blocked || isPast;
          let className = "bg-white text-[var(--koluj-text)] hover:bg-white/80";
          if (selected) className = props.isService ? "bg-[var(--koluj-green)] text-white" : "bg-orange-100 text-orange-900 ring-2 ring-orange-300";
          else if (reserved) className = "bg-red-100 text-red-700 cursor-not-allowed";
          else if (blocked) className = "bg-stone-200 text-stone-500 cursor-not-allowed";
          else if (isPast) className = "bg-white/50 text-stone-300 cursor-not-allowed";
          return <button key={isoDate} type="button" disabled={disabled} onClick={() => props.onDayClick(isoDate)} className={`aspect-square rounded-2xl text-sm font-black ${className}`} title={reserved ? "Rezervováno" : blocked ? "Blokováno vlastníkem" : isPast ? "Minulý den" : "Volné"}>{day.getDate()}</button>;
        })}
      </div>

      {props.isScheduledService && <div className="mt-5 rounded-3xl bg-white p-4">
        <p className="text-sm font-black text-[var(--koluj-muted)]">Vyber čas služby · {formatShortDate(props.selectedServiceDate)}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">Začátek<select value={props.serviceStartTime} onChange={(e) => props.onServiceSlotChange(e.target.value, props.serviceEndTime)} className="koluj-input bg-white"><option value="">Vyber začátek</option>{props.availableServiceStartTimes.map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold text-[var(--koluj-muted)]">Konec<select value={props.serviceEndTime} onChange={(e) => props.onServiceSlotChange(props.serviceStartTime, e.target.value)} className="koluj-input bg-white"><option value="">Vyber konec</option>{props.availableServiceEndTimes.map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
        </div>
        {props.availableServiceStartTimes.length === 0 ? <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-700">V tento den už není žádný volný 30minutový termín.</p> : <p className="mt-3 text-xs font-bold text-[var(--koluj-muted)]">Časy jsou po 30 minutách. Obsazené a blokované intervaly se automaticky nezobrazují.</p>}
      </div>}

      {props.isDeadlineService && <div className="mt-5 rounded-3xl bg-white p-4"><p className="font-black">Požadovaný termín dokončení</p><p className="mt-2 text-sm font-bold text-[var(--koluj-muted)]">Vyber jeden den. Konkrétní čas provedení domluvíš s poskytovatelem v chatu.</p>{props.selectedRange?.dateFrom && <p className="mt-3 rounded-2xl bg-[var(--koluj-bg)] px-4 py-3 font-black text-[var(--koluj-green)]">{formatShortDate(props.selectedRange.dateFrom)}</p>}</div>}

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--koluj-muted)]"><span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-white" /> Volné</span><span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-100" /> Rezervováno</span><span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-stone-200" /> Blokováno</span><span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-orange-100" /> Vybráno</span></div>

      {props.isOwner && <div className="mt-4 space-y-3">
        <input value={props.reason} onChange={(e) => props.onReasonChange(e.target.value)} placeholder="Poznámka k blokaci (volitelné)" className="koluj-input bg-white" />
        <button type="button" onClick={props.onCreateBlock} disabled={props.savingBlock || (props.isScheduledService ? !props.selectedSlot?.startsAt || !props.selectedSlot?.endsAt : !props.selectedRange?.dateFrom || !props.selectedRange?.dateTo)} className="koluj-button w-full px-5 py-3 disabled:cursor-not-allowed disabled:opacity-60">{props.savingBlock ? "Ukládám..." : props.isScheduledService ? "Blokovat vybraný čas" : "Blokovat vybraný termín"}</button>
        {props.blocks.length > 0 && <div className="space-y-2 pt-2"><p className="text-sm font-black text-[var(--koluj-muted)]">Blokace v tomto měsíci</p>{props.blocks.map((block) => <div key={block.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm font-bold"><span>{block.starts_at && block.ends_at ? `${formatShortDate(block.date_from)} · ${formatTime(block.starts_at)}–${formatTime(block.ends_at)}` : `${formatShortDate(block.date_from)} – ${formatShortDate(block.date_to)}`}</span><button type="button" onClick={() => props.onDeleteBlock(block.id)} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600" aria-label="Uvolnit termín"><Trash2 size={16} /></button></div>)}</div>}
      </div>}
      {props.loading && <p className="mt-3 text-center text-sm font-bold text-[var(--koluj-muted)]">Načítám dostupnost...</p>}
    </div>
  );
}
