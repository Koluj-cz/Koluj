import { createSupabaseAdminClient } from "@/lib/supabase/server";

const SERVICE_START_MINUTES = 8 * 60;
const SERVICE_END_MINUTES = 20 * 60;
const SERVICE_STEP_MINUTES = 30;
const APP_TIME_ZONE = "Europe/Prague";

type AvailabilityOffer = {
  id: string;
  offer_type?: string | null;
};

type TimedInterval = {
  offer_id: string;
  starts_at: string | null;
  ends_at: string | null;
};

type AvailabilityBlock = TimedInterval & {
  date_from: string;
  date_to: string;
};

function getPragueNowParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    today: `${values.year}-${values.month}-${values.day}`,
    minutesNow: Number(values.hour) * 60 + Number(values.minute),
  };
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}

function pragueDateTimeToIso(date: string, minutes: number) {
  const [year, month, day] = date.split("-").map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = getTimeZoneOffsetMilliseconds(utcGuess, APP_TIME_ZONE);

  return new Date(utcGuess.getTime() - offset).toISOString();
}

function roundsUpToStep(minutes: number) {
  return Math.ceil(minutes / SERVICE_STEP_MINUTES) * SERVICE_STEP_MINUTES;
}

function overlaps(
  slotStart: number,
  slotEnd: number,
  intervalStart: string | null,
  intervalEnd: string | null,
) {
  if (!intervalStart || !intervalEnd) return false;

  const start = new Date(intervalStart).getTime();
  const end = new Date(intervalEnd).getTime();

  return slotStart < end && slotEnd > start;
}

function serviceHasFreeSlot({
  today,
  minutesNow,
  bookings,
  blocks,
}: {
  today: string;
  minutesNow: number;
  bookings: TimedInterval[];
  blocks: AvailabilityBlock[];
}) {
  const hasFullDayBlock = blocks.some(
    (block) =>
      !block.starts_at &&
      block.date_from <= today &&
      block.date_to >= today,
  );

  if (hasFullDayBlock) return false;

  const firstPossibleStart = Math.max(
    SERVICE_START_MINUTES,
    roundsUpToStep(minutesNow),
  );

  for (
    let startMinutes = firstPossibleStart;
    startMinutes + SERVICE_STEP_MINUTES <= SERVICE_END_MINUTES;
    startMinutes += SERVICE_STEP_MINUTES
  ) {
    const endMinutes = startMinutes + SERVICE_STEP_MINUTES;
    const slotStart = new Date(
      pragueDateTimeToIso(today, startMinutes),
    ).getTime();
    const slotEnd = new Date(pragueDateTimeToIso(today, endMinutes)).getTime();

    const bookingConflict = bookings.some((booking) =>
      overlaps(slotStart, slotEnd, booking.starts_at, booking.ends_at),
    );

    const blockConflict = blocks.some((block) =>
      overlaps(slotStart, slotEnd, block.starts_at, block.ends_at),
    );

    if (!bookingConflict && !blockConflict) {
      return true;
    }
  }

  return false;
}

export async function attachTodayAvailabilityServer<
  T extends AvailabilityOffer,
>(items: T[]) {
  if (items.length === 0) {
    return items.map((item) => ({ ...item, is_reserved_today: false }));
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { today, minutesNow } = getPragueNowParts();
  const itemOfferIds = items
    .filter((item) => item.offer_type !== "service")
    .map((item) => item.id);
  const serviceOfferIds = items
    .filter((item) => item.offer_type === "service")
    .map((item) => item.id);

  const dayStart = pragueDateTimeToIso(today, 0);
  const dayEnd = pragueDateTimeToIso(today, 24 * 60);

  const [itemReservationsResult, blocksResult, serviceBookingsResult] =
    await Promise.all([
      itemOfferIds.length > 0
        ? supabaseAdmin
            .from("offer_reservations")
            .select("offer_id")
            .in("offer_id", itemOfferIds)
            .eq("status", "active")
            .lte("date_from", today)
            .gte("date_to", today)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from("offer_availability_blocks")
        .select("offer_id, date_from, date_to, starts_at, ends_at")
        .in(
          "offer_id",
          items.map((item) => item.id),
        )
        .lte("date_from", today)
        .gte("date_to", today),
      serviceOfferIds.length > 0
        ? supabaseAdmin
            .from("bookings")
            .select("offer_id, starts_at, ends_at")
            .in("offer_id", serviceOfferIds)
            .in("status", ["requested", "approved", "active"])
            .not("starts_at", "is", null)
            .lt("starts_at", dayEnd)
            .gt("ends_at", dayStart)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (itemReservationsResult.error) {
    throw new Error(itemReservationsResult.error.message);
  }

  if (blocksResult.error) {
    throw new Error(blocksResult.error.message);
  }

  if (serviceBookingsResult.error) {
    throw new Error(serviceBookingsResult.error.message);
  }

  const reservedItemIds = new Set(
    (itemReservationsResult.data || []).map((row) => row.offer_id),
  );

  const blocksByOfferId = new Map<string, AvailabilityBlock[]>();
  for (const block of blocksResult.data || []) {
    const current = blocksByOfferId.get(block.offer_id) || [];
    current.push(block as AvailabilityBlock);
    blocksByOfferId.set(block.offer_id, current);
  }

  const bookingsByOfferId = new Map<string, TimedInterval[]>();
  for (const booking of serviceBookingsResult.data || []) {
    const current = bookingsByOfferId.get(booking.offer_id) || [];
    current.push(booking as TimedInterval);
    bookingsByOfferId.set(booking.offer_id, current);
  }

  return items.map((item) => {
    const blocks = blocksByOfferId.get(item.id) || [];

    if (item.offer_type === "service") {
      const hasFreeSlot = serviceHasFreeSlot({
        today,
        minutesNow,
        bookings: bookingsByOfferId.get(item.id) || [],
        blocks,
      });

      return {
        ...item,
        is_reserved_today: !hasFreeSlot,
      };
    }

    return {
      ...item,
      is_reserved_today:
        reservedItemIds.has(item.id) || blocks.length > 0,
    };
  });
}
