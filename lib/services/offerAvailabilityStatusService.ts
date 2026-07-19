import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getServiceHoursForDate,
  minutesFromTime,
} from "@/lib/serviceBookingRules";

const STEP = 30;
const APP_TIME_ZONE = "Europe/Prague";

type AvailabilityStatus = "available" | "reserved" | "unavailable";

type Offer = {
  id: string;
  offer_type?: string | null;
  service_booking_mode?: string | null;
  service_hours_mode?: string | null;
  weekday_start_time?: string | null;
  weekday_end_time?: string | null;
  weekend_start_time?: string | null;
  weekend_end_time?: string | null;
};

type Interval = {
  offer_id: string;
  starts_at: string | null;
  ends_at: string | null;
};

type Block = Interval & {
  date_from: string;
  date_to: string;
};

function nowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    today: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function localIso(date: string, minutes: number) {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
  ).toISOString();
}

function overlaps(
  start: number,
  end: number,
  interval: Interval,
) {
  if (!interval.starts_at || !interval.ends_at) {
    return false;
  }

  return (
    start < new Date(interval.ends_at).getTime() &&
    end > new Date(interval.starts_at).getTime()
  );
}

export async function attachTodayAvailabilityServer<T extends Offer>(
  items: T[],
) {
  if (items.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { today, minutes } = nowParts();
  const offerIds = items.map((item) => item.id);

  const dayStart = localIso(today, 0);
  const dayEnd = localIso(today, 24 * 60);
  const nowIso = new Date().toISOString();

  const [reservationsResult, bookingsResult, activeItemBookingsResult, blocksResult] =
    await Promise.all([
      supabase
        .from("offer_reservations")
        .select("offer_id, starts_at, ends_at")
        .in("offer_id", offerIds)
        .eq("status", "active")
        .lte("date_from", today)
        .gte("date_to", today),

      supabase
        .from("bookings")
        .select("offer_id, starts_at, ends_at")
        .in("offer_id", offerIds)
        .in("status", ["requested", "approved", "active"])
        .not("starts_at", "is", null)
        .lt("starts_at", dayEnd)
        .gt("ends_at", dayStart),

      supabase
        .from("bookings")
        .select("offer_id, handed_over_at")
        .in("offer_id", offerIds)
        .eq("status", "active")
        .not("handed_over_at", "is", null)
        .lte("handed_over_at", nowIso),

      supabase
        .from("offer_availability_blocks")
        .select(
          "offer_id, date_from, date_to, starts_at, ends_at",
        )
        .in("offer_id", offerIds)
        .lte("date_from", today)
        .gte("date_to", today),
    ]);

  for (const result of [
    reservationsResult,
    bookingsResult,
    activeItemBookingsResult,
    blocksResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  return items.map((item) => {
    const itemBlocks = (blocksResult.data || []).filter(
      (block) => block.offer_id === item.id,
    ) as Block[];

    const fullDayBlocked = itemBlocks.some(
      (block) => !block.starts_at && !block.ends_at,
    );

    let availabilityStatus: AvailabilityStatus = "available";

    /*
     * Věc:
     * - ruční blokace = Nedostupné
     * - rezervace = Rezervované
     * - jinak = Volné
     */
    if (item.offer_type !== "service") {
      const hasPlannedReservationToday = (reservationsResult.data || []).some(
        (reservation) => reservation.offer_id === item.id,
      );

      const isActuallyHandedOver = (activeItemBookingsResult.data || []).some(
        (booking) => booking.offer_id === item.id,
      );

      const reserved = hasPlannedReservationToday || isActuallyHandedOver;

      availabilityStatus = fullDayBlocked
        ? "unavailable"
        : reserved
          ? "reserved"
          : "available";
    }

    /*
     * Flexibilní služba:
     * - dnešní celodenní blokace = Nedostupné
     * - jinak = Volné
     */
    else if (item.service_booking_mode === "deadline") {
      availabilityStatus = fullDayBlocked
        ? "unavailable"
        : "available";
    }

    /*
     * Služba s konkrétním časem.
     */
    else {
      const hours = getServiceHoursForDate(item, today);

      if (!hours || fullDayBlocked) {
        availabilityStatus = "unavailable";
      } else {
        const serviceStart = minutesFromTime(hours.start);
        const serviceEnd = minutesFromTime(hours.end);

        const nextHalfHour =
          Math.ceil(minutes / STEP) * STEP;

        const firstPossibleStart = Math.max(
          serviceStart,
          nextHalfHour,
        );

        /*
         * Po provozní době nebo pokud už nezbývá ani jeden
         * celý 30minutový slot.
         */
        if (firstPossibleStart + STEP > serviceEnd) {
          availabilityStatus = "unavailable";
        } else {
          const bookingIntervals = (
            bookingsResult.data || []
          ).filter(
            (booking) => booking.offer_id === item.id,
          ) as Interval[];

          const blockIntervals = itemBlocks.filter(
            (block) => block.starts_at && block.ends_at,
          );

          let hasCandidateSlot = false;
          let hasUnblockedSlot = false;
          let hasFreeSlot = false;

          for (
            let start = firstPossibleStart;
            start + STEP <= serviceEnd;
            start += STEP
          ) {
            hasCandidateSlot = true;

            const slotStart = new Date(
              localIso(today, start),
            ).getTime();

            const slotEnd = new Date(
              localIso(today, start + STEP),
            ).getTime();

            const isBlocked = blockIntervals.some((block) =>
              overlaps(slotStart, slotEnd, block),
            );

            if (isBlocked) {
              continue;
            }

            hasUnblockedSlot = true;

            const isReserved = bookingIntervals.some((booking) =>
              overlaps(slotStart, slotEnd, booking),
            );

            if (!isReserved) {
              hasFreeSlot = true;
              break;
            }
          }

          if (!hasCandidateSlot) {
            // Mimo provozní dobu.
            availabilityStatus = "unavailable";
          } else if (hasFreeSlot) {
            // Existuje alespoň jeden volný slot.
            availabilityStatus = "available";
          } else if (!hasUnblockedSlot) {
            // Všechny zbývající sloty zablokoval vlastník.
            availabilityStatus = "unavailable";
          } else {
            // Nezablokované sloty existují, ale všechny zabraly rezervace.
            availabilityStatus = "reserved";
          }
        }
      }
    }

    return {
      ...item,
      availability_status: availabilityStatus,
      is_reserved_today: availabilityStatus === "reserved",
    };
  });
}