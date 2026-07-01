import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toIsoDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().split("T")[0];
}

function dayStart(date: string) {
  return `${date}T00:00:00.000Z`;
}

function dayAfter(date: string) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

function assertDateRange(dateFrom?: string | null, dateTo?: string | null) {
  if (!dateFrom || !dateTo) {
    throw new Error("Vyber termín.");
  }

  if (dateTo < dateFrom) {
    throw new Error("Konec termínu nemůže být dřív než začátek.");
  }
}

function assertTimeRange(startsAt?: string | null, endsAt?: string | null) {
  if (!startsAt || !endsAt) {
    throw new Error("Vyber čas rezervace.");
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Vybraný čas není platný.");
  }

  if (end <= start) {
    throw new Error("Konec rezervace musí být později než začátek.");
  }
}

export async function getOfferAvailabilityServer({
  offerId,
  dateFrom,
  dateTo,
}: {
  offerId: string;
  dateFrom: string;
  dateTo: string;
}) {
  assertDateRange(dateFrom, dateTo);

  const rangeStart = dayStart(dateFrom);
  const rangeEnd = dayAfter(dateTo);

  const [dayReservationsResult, timeReservationsResult, dayBlocksResult, timeBlocksResult] =
    await Promise.all([
      supabaseAdmin
        .from("offer_reservations")
        .select("id, booking_id, date_from, date_to, starts_at, ends_at, status")
        .eq("offer_id", offerId)
        .eq("status", "active")
        .lte("date_from", dateTo)
        .gte("date_to", dateFrom),
      supabaseAdmin
        .from("offer_reservations")
        .select("id, booking_id, date_from, date_to, starts_at, ends_at, status")
        .eq("offer_id", offerId)
        .eq("status", "active")
        .not("starts_at", "is", null)
        .lt("starts_at", rangeEnd)
        .gt("ends_at", rangeStart),
      supabaseAdmin
        .from("offer_availability_blocks")
        .select("id, date_from, date_to, starts_at, ends_at, reason")
        .eq("offer_id", offerId)
        .lte("date_from", dateTo)
        .gte("date_to", dateFrom),
      supabaseAdmin
        .from("offer_availability_blocks")
        .select("id, date_from, date_to, starts_at, ends_at, reason")
        .eq("offer_id", offerId)
        .not("starts_at", "is", null)
        .lt("starts_at", rangeEnd)
        .gt("ends_at", rangeStart),
    ]);

  for (const result of [
    dayReservationsResult,
    timeReservationsResult,
    dayBlocksResult,
    timeBlocksResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const reservationsById = new Map<string, any>();
  [...(dayReservationsResult.data || []), ...(timeReservationsResult.data || [])].forEach(
    (reservation) => reservationsById.set(reservation.id, reservation)
  );

  const blocksById = new Map<string, any>();
  [...(dayBlocksResult.data || []), ...(timeBlocksResult.data || [])].forEach((block) =>
    blocksById.set(block.id, block)
  );

  return {
    reservations: Array.from(reservationsById.values()),
    blocks: Array.from(blocksById.values()),
  };
}

export async function assertOfferAvailableServer({
  offerId,
  dateFrom,
  dateTo,
  startsAt,
  endsAt,
  ignoreBookingId,
}: {
  offerId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  ignoreBookingId?: string | null;
}) {
  if (startsAt || endsAt) {
    assertTimeRange(startsAt, endsAt);

    const startDate = toIsoDate(startsAt!);
    const endDate = toIsoDate(endsAt!);

    const [bookingResult, blockResult] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("offer_id", offerId)
        .in("status", ["requested", "approved", "active"])
        .not("starts_at", "is", null)
        .lt("starts_at", endsAt!)
        .gt("ends_at", startsAt!)
        .limit(1),
      supabaseAdmin
        .from("offer_availability_blocks")
        .select("id")
        .eq("offer_id", offerId)
        .or(
          `and(starts_at.not.is.null,starts_at.lt.${endsAt},ends_at.gt.${startsAt}),and(starts_at.is.null,date_from.lte.${endDate},date_to.gte.${startDate})`
        )
        .limit(1),
    ]);

    if (bookingResult.error) throw new Error(bookingResult.error.message);
    if (blockResult.error) throw new Error(blockResult.error.message);

    const overlappingBookings = (bookingResult.data || []).filter(
      (booking) => booking.id !== ignoreBookingId
    );

    if (overlappingBookings.length > 0 || (blockResult.data || []).length > 0) {
      throw new Error("Vybraný čas už není dostupný.");
    }

    return;
  }

  assertDateRange(dateFrom, dateTo);

  const [reservationResult, blockResult] = await Promise.all([
    supabaseAdmin
      .from("offer_reservations")
      .select("id, booking_id")
      .eq("offer_id", offerId)
      .eq("status", "active")
      .lte("date_from", dateTo!)
      .gte("date_to", dateFrom!)
      .limit(1),
    supabaseAdmin
      .from("offer_availability_blocks")
      .select("id")
      .eq("offer_id", offerId)
      .lte("date_from", dateTo!)
      .gte("date_to", dateFrom!)
      .limit(1),
  ]);

  if (reservationResult.error) throw new Error(reservationResult.error.message);
  if (blockResult.error) throw new Error(blockResult.error.message);

  const overlappingReservations = (reservationResult.data || []).filter(
    (reservation) => reservation.booking_id !== ignoreBookingId
  );

  if (overlappingReservations.length > 0 || (blockResult.data || []).length > 0) {
    throw new Error("Vybraný termín už není dostupný.");
  }
}

export async function createAvailabilityBlockServer({
  offerId,
  ownerId,
  dateFrom,
  dateTo,
  startsAt,
  endsAt,
  reason,
}: {
  offerId: string;
  ownerId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  reason?: string | null;
}) {
  const { data: offer, error: offerError } = await supabaseAdmin
    .from("offers")
    .select("id, owner_id")
    .eq("id", offerId)
    .single();

  if (offerError || !offer) throw new Error("Nabídka nebyla nalezena");
  if (offer.owner_id !== ownerId) throw new Error("Blokaci může vytvořit pouze vlastník");

  if (startsAt || endsAt) {
    assertTimeRange(startsAt, endsAt);
    dateFrom = toIsoDate(startsAt!);
    dateTo = toIsoDate(endsAt!);
  } else {
    assertDateRange(dateFrom, dateTo);
  }

  await assertOfferAvailableServer({
    offerId,
    dateFrom,
    dateTo,
    startsAt,
    endsAt,
  });

  const { data: block, error } = await supabaseAdmin
    .from("offer_availability_blocks")
    .insert({
      offer_id: offerId,
      owner_id: ownerId,
      date_from: dateFrom,
      date_to: dateTo,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      reason: reason?.trim() || null,
    })
    .select("id, date_from, date_to, starts_at, ends_at, reason")
    .single();

  if (error || !block) throw new Error(error?.message || "Blokaci se nepodařilo vytvořit");
  return block;
}

export async function deleteAvailabilityBlockServer({
  blockId,
  ownerId,
}: {
  blockId: string;
  ownerId: string;
}) {
  const { error } = await supabaseAdmin
    .from("offer_availability_blocks")
    .delete()
    .eq("id", blockId)
    .eq("owner_id", ownerId);

  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function createReservationForBookingServer(bookingId: string) {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, offer_id, date_from, date_to, starts_at, ends_at")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) throw new Error("Rezervace nebyla nalezena");

  const dateFrom = booking.date_from || (booking.starts_at ? toIsoDate(booking.starts_at) : null);
  const dateTo = booking.date_to || (booking.ends_at ? toIsoDate(booking.ends_at) : null);

  if (!dateFrom || !dateTo) throw new Error("Rezervace nemá vybraný termín.");

  await assertOfferAvailableServer({
    offerId: booking.offer_id,
    dateFrom,
    dateTo,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    ignoreBookingId: booking.id,
  });

  const { error } = await supabaseAdmin.from("offer_reservations").insert({
    offer_id: booking.offer_id,
    booking_id: booking.id,
    date_from: dateFrom,
    date_to: dateTo,
    starts_at: booking.starts_at || null,
    ends_at: booking.ends_at || null,
    status: "active",
  });

  if (error) throw new Error(error.message);
}

export async function cancelReservationForBookingServer(bookingId: string) {
  const { error } = await supabaseAdmin
    .from("offer_reservations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
}

export async function finishReservationForBookingServer(bookingId: string) {
  const { error } = await supabaseAdmin
    .from("offer_reservations")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
}
