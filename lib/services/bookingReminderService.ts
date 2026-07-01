import { createClient } from "@supabase/supabase-js";
import { notifyUserServer } from "@/lib/notifyUserServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ReminderType = "handover_24h" | "return_24h";

type BookingReminderRow = {
  id: string;
  offer_id: string;
  owner_id: string;
  customer_id: string;
  status: string;
  date_from: string | null;
  date_to: string | null;
  offers:
    | {
        id: string;
        title: string | null;
      }
    | {
        id: string;
        title: string | null;
      }[]
    | null;
  owner:
    | {
        full_name: string | null;
      }
    | {
        full_name: string | null;
      }[]
    | null;
  customer:
    | {
        full_name: string | null;
      }
    | {
        full_name: string | null;
      }[]
    | null;
};

function getTomorrowIsoDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

function firstOrValue<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

async function reserveReminderSlot(bookingId: string, type: ReminderType) {
  const { error } = await supabaseAdmin.from("booking_reminders").insert({
    booking_id: bookingId,
    type,
  });

  if (!error) return true;

  if (error.code === "23505") {
    return false;
  }

  throw new Error(error.message);
}

async function loadBookingsForHandoverReminder(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(`
      id,
      offer_id,
      owner_id,
      customer_id,
      status,
      date_from,
      date_to,
      offers:offers!bookings_offer_id_fkey (
        id,
        title
      ),
      owner:profiles!bookings_owner_id_fkey (
        full_name
      ),
      customer:profiles!bookings_customer_id_fkey (
        full_name
      )
    `)
    .eq("status", "approved")
    .eq("date_from", targetDate);

  if (error) throw new Error(error.message);
  return (data || []) as unknown as BookingReminderRow[];
}

async function loadBookingsForReturnReminder(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(`
      id,
      offer_id,
      owner_id,
      customer_id,
      status,
      date_from,
      date_to,
      offers:offers!bookings_offer_id_fkey (
        id,
        title
      ),
      owner:profiles!bookings_owner_id_fkey (
        full_name
      ),
      customer:profiles!bookings_customer_id_fkey (
        full_name
      )
    `)
    .eq("status", "active")
    .eq("date_to", targetDate);

  if (error) throw new Error(error.message);
  return (data || []) as unknown as BookingReminderRow[];
}

export async function sendBookingRemindersServer() {
  const targetDate = getTomorrowIsoDate();

  let handoverSent = 0;
  let returnSent = 0;

  const handoverBookings = await loadBookingsForHandoverReminder(targetDate);

  for (const booking of handoverBookings) {
    const shouldSend = await reserveReminderSlot(booking.id, "handover_24h");
    if (!shouldSend) continue;

    const offer = firstOrValue(booking.offers);
    const owner = firstOrValue(booking.owner);
    const customer = firstOrValue(booking.customer);
    const offerTitle = offer?.title || "nabídku";
    const ownerName = owner?.full_name || "vlastníka";
    const customerName = customer?.full_name || "rezervujícího";

    await notifyUserServer({
      userId: booking.owner_id,
      actorId: null,
      bookingId: booking.id,
      offerId: booking.offer_id,
      type: "booking_handover_reminder_24h",
      title: "Zítra začíná rezervace",
      message: `Zítra začíná rezervace „${offerTitle}“ uživateli ${customerName}.`,
      emailSubject: "Připomínka začátku rezervace",
    });

    await notifyUserServer({
      userId: booking.customer_id,
      actorId: null,
      bookingId: booking.id,
      offerId: booking.offer_id,
      type: "booking_handover_reminder_24h",
      title: "Zítra začíná tvoje rezervace",
      message: `Zítra začíná tvoje rezervace „${offerTitle}“ od uživatele ${ownerName}.`,
      emailSubject: "Připomínka začátku rezervace",
    });

    handoverSent += 2;
  }

  const returnBookings = await loadBookingsForReturnReminder(targetDate);

  for (const booking of returnBookings) {
    const shouldSend = await reserveReminderSlot(booking.id, "return_24h");
    if (!shouldSend) continue;

    const offer = firstOrValue(booking.offers);
    const customer = firstOrValue(booking.customer);
    const offerTitle = offer?.title || "nabídku";
    const customerName = customer?.full_name || "rezervujícího";

    await notifyUserServer({
      userId: booking.owner_id,
      actorId: null,
      bookingId: booking.id,
      offerId: booking.offer_id,
      type: "booking_return_reminder_24h",
      title: "Zítra končí rezervace",
      message: `Zítra končí rezervace „${offerTitle}“ s uživatelem ${customerName}.`,
      emailSubject: "Připomínka konce rezervace",
    });

    await notifyUserServer({
      userId: booking.customer_id,
      actorId: null,
      bookingId: booking.id,
      offerId: booking.offer_id,
      type: "booking_return_reminder_24h",
      title: "Zítra končí tvoje rezervace",
      message: `Zítra končí tvoje rezervace „${offerTitle}“.`,
      emailSubject: "Připomínka konce rezervace",
    });

    returnSent += 2;
  }

  return {
    ok: true,
    targetDate,
    handoverBookings: handoverBookings.length,
    returnBookings: returnBookings.length,
    notificationsSent: handoverSent + returnSent,
  };
}
