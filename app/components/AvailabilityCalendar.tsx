"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AvailabilityCalendarView from "@/app/components/availability/AvailabilityCalendarView";
import type { AvailabilityCalendarProps, Block, Reservation, SelectedSlot } from "@/app/components/availability/types";
import { buildMonthDays, eachDateInRange, makeLocalDateTime, overlaps, SERVICE_STEP_MINUTES, timeFromIso, toIsoDate } from "@/app/components/availability/utils";
import { buildTimeOptions, getServiceHoursForDate, minutesFromTime } from "@/lib/serviceBookingRules";

export default function AvailabilityCalendar({
  offerId,
  offerType = "item",
  isOwner = false,
  selectedRange,
  selectedSlot,
  onRangeChange,
  onSlotChange,
  serviceBookingMode = "scheduled",
  serviceHoursMode = "same_every_day",
  weekdayStartTime = "08:00",
  weekdayEndTime = "20:00",
  weekendStartTime = "08:00",
  weekendEndTime = "20:00",
}: AvailabilityCalendarProps) {
  const isService = offerType === "service";
  const isDeadlineService = isService && serviceBookingMode === "deadline";
  const isScheduledService = isService && !isDeadlineService;
  const todayIso = toIsoDate(new Date());

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
    if (selectedSlot?.startsAt && selectedSlot?.endsAt) {
      setSelectedServiceDate(toIsoDate(new Date(selectedSlot.startsAt)));
      setServiceStartTime(timeFromIso(selectedSlot.startsAt));
      setServiceEndTime(timeFromIso(selectedSlot.endsAt));
      return;
    }

    setServiceStartTime("");
    setServiceEndTime("");
  }, [selectedSlot?.startsAt, selectedSlot?.endsAt]);


  useEffect(() => {
    if (isDeadlineService && selectedRange?.dateFrom) {
      setSelectedServiceDate(selectedRange.dateFrom);
    }
  }, [isDeadlineService, selectedRange?.dateFrom]);
  const loadAvailability = useCallback(async () => {
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
  }, [firstVisibleDate, lastVisibleDate, offerId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

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

  const hasBusyServiceSlot = useCallback((slot: SelectedSlot) => {
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
  }, [blocks, reservations, selectedServiceDate]);

  const selectedServiceHours = useMemo(
    () =>
      getServiceHoursForDate(
        {
          service_booking_mode: serviceBookingMode,
          service_hours_mode: serviceHoursMode,
          weekday_start_time: weekdayStartTime,
          weekday_end_time: weekdayEndTime,
          weekend_start_time: weekendStartTime,
          weekend_end_time: weekendEndTime,
        },
        selectedServiceDate,
      ),
    [
      serviceBookingMode,
      serviceHoursMode,
      weekdayStartTime,
      weekdayEndTime,
      weekendStartTime,
      weekendEndTime,
      selectedServiceDate,
    ],
  );

  const serviceTimeOptions = useMemo(
    () =>
      selectedServiceHours
        ? buildTimeOptions(selectedServiceHours.start, selectedServiceHours.end, SERVICE_STEP_MINUTES)
        : [],
    [selectedServiceHours],
  );

  const isServiceRangeAvailable = useCallback((startTime: string, endTime: string) => {
    if (!startTime || !endTime) return false;

    if (minutesFromTime(endTime) <= minutesFromTime(startTime)) {
      return false;
    }

    const slot = {
      startsAt: makeLocalDateTime(selectedServiceDate, startTime),
      endsAt: makeLocalDateTime(selectedServiceDate, endTime),
    };

    if (new Date(slot.startsAt) < new Date()) {
      return false;
    }

    return !hasBusyServiceSlot(slot);
  }, [hasBusyServiceSlot, selectedServiceDate]);

  const availableServiceStartTimes = useMemo(() => {
    return serviceTimeOptions.slice(0, -1).filter((startTime) => {
      const nextTime = serviceTimeOptions.find(
        (time) =>
          minutesFromTime(time) ===
          minutesFromTime(startTime) + SERVICE_STEP_MINUTES
      );

      return Boolean(nextTime && isServiceRangeAvailable(startTime, nextTime));
    });
  }, [isServiceRangeAvailable, serviceTimeOptions]);

  const availableServiceEndTimes = useMemo(() => {
    if (!serviceStartTime) return [];

    return serviceTimeOptions
      .slice(1)
      .filter((endTime) =>
        isServiceRangeAvailable(serviceStartTime, endTime)
      );
  }, [isServiceRangeAvailable, serviceStartTime, serviceTimeOptions]);

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
    if (isDeadlineService) {
      if (date < todayIso || blockDates.has(date)) return;
      setSelectedServiceDate(date);
      onRangeChange?.({ dateFrom: date, dateTo: date });
      onSlotChange?.(null);
      return;
    }

    if (isScheduledService) {
      setSelectedServiceDate(date);
      setServiceStartTime("");
      setServiceEndTime("");
      onSlotChange?.(null);
      onRangeChange?.(null);
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

    const body = isScheduledService
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

    if (isScheduledService && (!selectedSlot?.startsAt || !selectedSlot?.endsAt)) return;
    if (!isScheduledService && (!selectedRange?.dateFrom || !selectedRange?.dateTo)) return;

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

    toast.success(isScheduledService ? "Čas byl zablokován" : "Termín byl zablokován");
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

  return (
    <AvailabilityCalendarView
      visibleMonth={visibleMonth}
      days={days}
      isService={isService}
      isDeadlineService={isDeadlineService}
      isScheduledService={isScheduledService}
      selectedServiceDate={selectedServiceDate}
      selectedRange={selectedRange}
      selectedSlot={selectedSlot}
      reservationDates={reservationDates}
      blockDates={blockDates}
      selectedDates={selectedDates}
      serviceBookingMode={serviceBookingMode}
      serviceHoursMode={serviceHoursMode}
      weekdayStartTime={weekdayStartTime}
      weekdayEndTime={weekdayEndTime}
      weekendStartTime={weekendStartTime}
      weekendEndTime={weekendEndTime}
      serviceStartTime={serviceStartTime}
      serviceEndTime={serviceEndTime}
      availableServiceStartTimes={availableServiceStartTimes}
      availableServiceEndTimes={availableServiceEndTimes}
      isOwner={isOwner}
      reason={reason}
      savingBlock={savingBlock}
      blocks={blocks}
      loading={loading}
      onPreviousMonth={previousMonth}
      onNextMonth={nextMonth}
      onDayClick={handleDayClick}
      onServiceSlotChange={updateServiceSlot}
      onReasonChange={setReason}
      onCreateBlock={() => void createBlock()}
      onDeleteBlock={(id) => void deleteBlock(id)}
    />
  );
}
