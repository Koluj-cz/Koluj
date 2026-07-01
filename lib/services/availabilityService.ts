import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type AvailabilityEntry = {
  id: string;
  offer_id: string;
  date_from: string;
  date_to: string;
};

export type AvailabilityReservation = AvailabilityEntry & {
  booking_id: string;
  status: string;
};

export type AvailabilityBlock = AvailabilityEntry & {
  owner_id: string;
  reason: string | null;
};

function normalizeDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Neplatný formát data.");
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Neplatné datum.");
  }

  return value;
}

export function normalizeDateRange(dateFrom: string, dateTo: string) {
  const from = normalizeDate(dateFrom);
  const to = normalizeDate(dateTo);

  if (new Date(`${to}T00:00:00`) < new Date(`${from}T00:00:00`)) {
    throw new Error("Datum vrácení nemůže být dřív než datum rezervace.");
  }

  return { dateFrom: from, dateTo: to };
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
  const range = normalizeDateRange(dateFrom, dateTo);

  const [reservationsResult, blocksResult] = await Promise.all([
    supabaseAdmin
      .from("offer_reservations")
      .select("id, offer_id, booking_id, date_from, date_to, status")
      .eq("offer_id", offerId)
      .eq("status", "active")
      .lte("date_from", range.dateTo)
      .gte("date_to", range.dateFrom)
      .order("date_from", { ascending: true }),
    supabaseAdmin
      .from("offer_availability_blocks")
      .select("id, offer_id, owner_id, date_from, date_to, reason")
      .eq("offer_id", offerId)
      .lte("date_from", range.dateTo)
      .gte("date_to", range.dateFrom)
      .order("date_from", { ascending: true }),
  ]);

  if (reservationsResult.error) {
    throw new Error(reservationsResult.error.message);
  }

  if (blocksResult.error) {
    throw new Error(blocksResult.error.message);
  }

  return {
    reservations: (reservationsResult.data || []) as AvailabilityReservation[],
    blocks: (blocksResult.data || []) as AvailabilityBlock[],
  };
}

export async function assertOfferAvailableServer({
  offerId,
  dateFrom,
  dateTo,
}: {
  offerId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const availability = await getOfferAvailabilityServer({
    offerId,
    dateFrom,
    dateTo,
  });

  if (availability.reservations.length > 0) {
    throw new Error("Vybraný termín je už rezervovaný.");
  }

  if (availability.blocks.length > 0) {
    throw new Error("Vybraný termín je blokovaný vlastníkem.");
  }
}

export async function createReservationForBookingServer(bookingId: string) {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, offer_id, date_from, date_to, status")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    throw new Error("Rezervace nebyla nalezena.");
  }

  if (!booking.date_from || !booking.date_to) {
    throw new Error("Rezervace nemá vybraný termín.");
  }

  await assertOfferAvailableServer({
    offerId: booking.offer_id,
    dateFrom: booking.date_from,
    dateTo: booking.date_to,
  });

  const { data: existingReservation, error: existingError } = await supabaseAdmin
    .from("offer_reservations")
    .select("id, status")
    .eq("booking_id", booking.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingReservation) {
    const { error } = await supabaseAdmin
      .from("offer_reservations")
      .update({
        status: "active",
        date_from: booking.date_from,
        date_to: booking.date_to,
        cancelled_at: null,
        finished_at: null,
      })
      .eq("id", existingReservation.id);

    if (error) throw new Error(error.message);
    return existingReservation.id;
  }

  const { data: reservation, error } = await supabaseAdmin
    .from("offer_reservations")
    .insert({
      offer_id: booking.offer_id,
      booking_id: booking.id,
      date_from: booking.date_from,
      date_to: booking.date_to,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !reservation) {
    throw new Error(error?.message || "Rezervaci se nepodařilo vytvořit.");
  }

  return reservation.id;
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

export async function createAvailabilityBlockServer({
  offerId,
  ownerId,
  dateFrom,
  dateTo,
  reason,
}: {
  offerId: string;
  ownerId: string;
  dateFrom: string;
  dateTo: string;
  reason?: string;
}) {
  const range = normalizeDateRange(dateFrom, dateTo);

  const { data: offer, error: offerError } = await supabaseAdmin
    .from("offers")
    .select("id, owner_id")
    .eq("id", offerId)
    .is("deleted_at", null)
    .single();

  if (offerError || !offer) {
    throw new Error("Nabídka nebyla nalezena.");
  }

  if (offer.owner_id !== ownerId) {
    throw new Error("Blokace může upravovat pouze vlastník nabídky.");
  }

  await assertOfferAvailableServer({
    offerId,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  });

  const { data: block, error } = await supabaseAdmin
    .from("offer_availability_blocks")
    .insert({
      offer_id: offerId,
      owner_id: ownerId,
      date_from: range.dateFrom,
      date_to: range.dateTo,
      reason: reason?.trim() || null,
    })
    .select("id, offer_id, owner_id, date_from, date_to, reason")
    .single();

  if (error || !block) {
    throw new Error(error?.message || "Blokaci se nepodařilo vytvořit.");
  }

  return block as AvailabilityBlock;
}

export async function deleteAvailabilityBlockServer({
  blockId,
  ownerId,
}: {
  blockId: string;
  ownerId: string;
}) {
  const { data: block, error: blockError } = await supabaseAdmin
    .from("offer_availability_blocks")
    .select("id, owner_id")
    .eq("id", blockId)
    .single();

  if (blockError || !block) {
    throw new Error("Blokace nebyla nalezena.");
  }

  if (block.owner_id !== ownerId) {
    throw new Error("Blokaci může zrušit pouze vlastník nabídky.");
  }

  const { error } = await supabaseAdmin
    .from("offer_availability_blocks")
    .delete()
    .eq("id", blockId);

  if (error) throw new Error(error.message);

  return { ok: true };
}
