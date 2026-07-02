import { createClient } from "@supabase/supabase-js";
import { notifyUserServer } from "@/lib/notifyUserServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ReminderType = "handover_24h" | "return_24h" | "service_start_1h";

type BookingReminderRow = {
  id: string;
  offer_id: string;
  owner_id: string;
  customer_id: string;
  status: string;
  date_from: string | null;
  date_to: string | null;
  starts_at: string | null;
  ends_at: string | null;
  offers:
    | { id: string; title: string | null; offer_type: string | null }
    | { id: string; title: string | null; offer_type: string | null }[]
    | null;
  owner: { full_name: string | null } | { full_name: string | null }[] | null;
  customer: { full_name: string | null } | { full_name: string | null }[] | null;
};

const baseSelect = `
  id,
  offer_id,
  owner_id,
  customer_id,
  status,
  date_from,
  date_to,
  starts_at,
  ends_at,
  offers:offers!bookings_offer_id_fkey (
    id,
    title,
    offer_type
  ),
  owner:profiles!bookings_owner_id_fkey (
    full_name
  ),
  customer:profiles!bookings_customer_id_fkey (
    full_name
  )
`;

function getTomorrowIsoDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

function firstOrValue<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function hourWindowFromNow() {
  const from = new Date(Date.now() + 55 * 60 * 1000);
  const to = new Date(Date.now() + 65 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function reserveReminderSlot(bookingId: string, type: ReminderType) {
  const { error } = await supabaseAdmin.from("booking_reminders").insert({
    booking_id: bookingId,
    type,
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

async function loadItemBookingsForHandoverReminder(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(baseSelect)
    .eq("status", "approved")
    .eq("date_from", targetDate)
    .is("starts_at", null);

  if (error) throw new Error(error.message);
  return (data || []) as unknown as BookingReminderRow[];
}

async function loadItemBookingsForReturnReminder(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(baseSelect)
    .eq("status", "active")
    .eq("date_to", targetDate)
    .is("ends_at", null);

  if (error) throw new Error(error.message);
  return (data || []) as unknown as BookingReminderRow[];
}

async function loadTimedServiceBookingsForStartReminder() {
  const { from, to } = hourWindowFromNow();

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(baseSelect)
    .eq("status", "active")
    .not("starts_at", "is", null)
    .gte("starts_at", from)
    .lt("starts_at", to);

  if (error) throw new Error(error.message);

  return ((data || []) as unknown as BookingReminderRow[]).filter(
    (booking) => firstOrValue(booking.offers)?.offer_type === "service"
  );
}

export async function sendBookingRemindersServer() {
  const targetDate = getTomorrowIsoDate();

  let handoverSent = 0;
  let returnSent = 0;
  let serviceStartSent = 0;

  const handoverBookings = await loadItemBookingsForHandoverReminder(targetDate);

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

  const returnBookings = await loadItemBookingsForReturnReminder(targetDate);

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

  const serviceBookings = await loadTimedServiceBookingsForStartReminder();

  for (const booking of serviceBookings) {
    const shouldSend = await reserveReminderSlot(booking.id, "service_start_1h");
    if (!shouldSend) continue;

    const offer = firstOrValue(booking.offers);
    const owner = firstOrValue(booking.owner);
    const customer = firstOrValue(booking.customer);
    const offerTitle = offer?.title || "službu";
    const ownerName = owner?.full_name || "poskytovatele";
    const customerName = customer?.full_name || "zákazníka";

    await notifyUserServer({
      userId: booking.owner_id,
      actorId: null,
      bookingId: booking.id,
      offerId: booking.offer_id,
      type: "service_start_reminder_1h",
      title: "Za hodinu začíná služba",
      message: `Za hodinu začíná služba „${offerTitle}“ pro uživatele ${customerName}.`,
      emailSubject: "Připomínka služby",
    });

    await notifyUserServer({
      userId: booking.customer_id,
      actorId: null,
      bookingId: booking.id,
      offerId: booking.offer_id,
      type: "service_start_reminder_1h",
      title: "Za hodinu začíná tvoje služba",
      message: `Za hodinu začíná tvoje služba „${offerTitle}“ od uživatele ${ownerName}.`,
      emailSubject: "Připomínka služby",
    });

    serviceStartSent += 2;
  }

  return {
    ok: true,
    targetDate,
    handoverBookings: handoverBookings.length,
    returnBookings: returnBookings.length,
    serviceBookings: serviceBookings.length,
    notificationsSent: handoverSent + returnSent + serviceStartSent,
  };
}
