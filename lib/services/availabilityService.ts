import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type AvailabilityEntry = {
  id: string;
  item_id: string;
  date_from: string;
  date_to: string;
};

export type AvailabilityReservation = AvailabilityEntry & {
  loan_id: string;
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
    throw new Error("Datum vrácení nemůže být dřív než datum půjčení.");
  }

  return { dateFrom: from, dateTo: to };
}

export async function getItemAvailabilityServer({
  itemId,
  dateFrom,
  dateTo,
}: {
  itemId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const range = normalizeDateRange(dateFrom, dateTo);

  const [reservationsResult, blocksResult] = await Promise.all([
    supabaseAdmin
      .from("item_reservations")
      .select("id, item_id, loan_id, date_from, date_to, status")
      .eq("item_id", itemId)
      .eq("status", "active")
      .lte("date_from", range.dateTo)
      .gte("date_to", range.dateFrom)
      .order("date_from", { ascending: true }),
    supabaseAdmin
      .from("item_availability_blocks")
      .select("id, item_id, owner_id, date_from, date_to, reason")
      .eq("item_id", itemId)
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

export async function assertItemAvailableServer({
  itemId,
  dateFrom,
  dateTo,
}: {
  itemId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const availability = await getItemAvailabilityServer({
    itemId,
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

export async function createReservationForLoanServer(loanId: string) {
  const { data: loan, error: loanError } = await supabaseAdmin
    .from("loans")
    .select("id, item_id, date_from, date_to, status")
    .eq("id", loanId)
    .single();

  if (loanError || !loan) {
    throw new Error("Půjčka nebyla nalezena.");
  }

  if (!loan.date_from || !loan.date_to) {
    throw new Error("Půjčka nemá vybraný termín.");
  }

  await assertItemAvailableServer({
    itemId: loan.item_id,
    dateFrom: loan.date_from,
    dateTo: loan.date_to,
  });

  const { data: existingReservation, error: existingError } = await supabaseAdmin
    .from("item_reservations")
    .select("id, status")
    .eq("loan_id", loan.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingReservation) {
    const { error } = await supabaseAdmin
      .from("item_reservations")
      .update({
        status: "active",
        date_from: loan.date_from,
        date_to: loan.date_to,
        cancelled_at: null,
        finished_at: null,
      })
      .eq("id", existingReservation.id);

    if (error) throw new Error(error.message);
    return existingReservation.id;
  }

  const { data: reservation, error } = await supabaseAdmin
    .from("item_reservations")
    .insert({
      item_id: loan.item_id,
      loan_id: loan.id,
      date_from: loan.date_from,
      date_to: loan.date_to,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !reservation) {
    throw new Error(error?.message || "Rezervaci se nepodařilo vytvořit.");
  }

  return reservation.id;
}

export async function cancelReservationForLoanServer(loanId: string) {
  const { error } = await supabaseAdmin
    .from("item_reservations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("loan_id", loanId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
}

export async function finishReservationForLoanServer(loanId: string) {
  const { error } = await supabaseAdmin
    .from("item_reservations")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("loan_id", loanId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
}

export async function createAvailabilityBlockServer({
  itemId,
  ownerId,
  dateFrom,
  dateTo,
  reason,
}: {
  itemId: string;
  ownerId: string;
  dateFrom: string;
  dateTo: string;
  reason?: string;
}) {
  const range = normalizeDateRange(dateFrom, dateTo);

  const { data: item, error: itemError } = await supabaseAdmin
    .from("items")
    .select("id, owner_id")
    .eq("id", itemId)
    .is("deleted_at", null)
    .single();

  if (itemError || !item) {
    throw new Error("Věc nebyla nalezena.");
  }

  if (item.owner_id !== ownerId) {
    throw new Error("Blokace může upravovat pouze vlastník věci.");
  }

  await assertItemAvailableServer({
    itemId,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  });

  const { data: block, error } = await supabaseAdmin
    .from("item_availability_blocks")
    .insert({
      item_id: itemId,
      owner_id: ownerId,
      date_from: range.dateFrom,
      date_to: range.dateTo,
      reason: reason?.trim() || null,
    })
    .select("id, item_id, owner_id, date_from, date_to, reason")
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
    .from("item_availability_blocks")
    .select("id, owner_id")
    .eq("id", blockId)
    .single();

  if (blockError || !block) {
    throw new Error("Blokace nebyla nalezena.");
  }

  if (block.owner_id !== ownerId) {
    throw new Error("Blokaci může zrušit pouze vlastník věci.");
  }

  const { error } = await supabaseAdmin
    .from("item_availability_blocks")
    .delete()
    .eq("id", blockId);

  if (error) throw new Error(error.message);

  return { ok: true };
}
