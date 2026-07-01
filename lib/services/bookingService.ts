import { createClient } from "@supabase/supabase-js";
import { notifyUserServer } from "@/lib/notifyUserServer";
import { containsForbiddenText } from "@/lib/moderation";
import {
  assertOfferAvailableServer,
  cancelReservationForBookingServer,
  createReservationForBookingServer,
  finishReservationForBookingServer,
} from "@/lib/services/availabilityService";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatDate(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("cs-CZ");
}

async function addSystemMessage({
  bookingId,
  actorId,
  message,
}: {
  bookingId: string;
  actorId: string;
  message: string;
}) {
  const { error } = await supabaseAdmin.from("booking_messages").insert({
    booking_id: bookingId,
    sender_id: actorId,
    is_system: true,
    message,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function loadBookingWithOffer(bookingId: string) {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, owner_id, customer_id, offer_id, status, date_from, date_to")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    throw new Error("Rezervace nebyla nalezena");
  }

  const { data: offer, error: offerError } = await supabaseAdmin
    .from("offers")
    .select("id, title, status")
    .eq("id", booking.offer_id)
    .single();

  if (offerError || !offer) {
    throw new Error("Nabídka nebyla nalezena");
  }

  return { booking, offer };
}

async function notifyAvailabilityWatchers({
  offerId,
  actorId,
}: {
  offerId: string;
  actorId: string;
}) {
  const { data: offer, error: offerError } = await supabaseAdmin
    .from("offers")
    .select("id, title, owner_id")
    .eq("id", offerId)
    .single();

  if (offerError || !offer) {
    throw new Error("Nabídka nebyla nalezena");
  }

  const { data: watchers, error: watchersError } = await supabaseAdmin
    .from("offer_availability_watchers")
    .select("user_id")
    .eq("offer_id", offerId)
    .is("notified_at", null);

  if (watchersError) {
    throw new Error(watchersError.message);
  }

  const recipients = (watchers || []).filter(
    (watcher) => watcher.user_id !== offer.owner_id
  );

  for (const watcher of recipients) {
    await notifyUserServer({
      userId: watcher.user_id,
      actorId,
      offerId: offer.id,
      type: "offer_available",
      title: "Nabídka je znovu dostupná",
      message: `${offer.title} je opět k rezervaci.`,
      emailSubject: "Nabídka je znovu dostupná",
      url: `/offers/${offer.id}`,
    });
  }

  if (recipients.length > 0) {
    await supabaseAdmin
      .from("offer_availability_watchers")
      .update({ notified_at: new Date().toISOString() })
      .eq("offer_id", offerId)
      .is("notified_at", null);
  }

  return recipients.length;
}

export async function requestBookingServer({
  offerId,
  customerId,
  dateFrom,
  dateTo,
  note,
}: {
  offerId: string;
  customerId: string;
  dateFrom: string;
  dateTo: string;
  note?: string;
}) {
  if (!dateFrom || !dateTo) {
    throw new Error("Vyber termín rezervace.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);

  if (fromDate < today) {
    throw new Error("Datum rezervace nemůže být v minulosti.");
  }

  if (toDate < fromDate) {
    throw new Error("Datum vrácení nemůže být dřív než datum rezervace.");
  }

  const { data: offer, error: offerError } = await supabaseAdmin
    .from("offers")
    .select(`
      id,
      owner_id,
      title,
      status,
      pickup_place,
      price_amount,
      deposit,
      profiles:profiles!offers_owner_id_fkey (
        is_seed_user
      )
    `)
    .eq("id", offerId)
    .single();

  if (offerError || !offer) {
    throw new Error("Nabídka nebyla nalezena");
  }

  if (offer.owner_id === customerId) {
    throw new Error("Vlastní nabídku si nemůžeš rezervovat");
  }

  const profile = Array.isArray(offer.profiles)
    ? offer.profiles[0]
    : offer.profiles;

  if (profile?.is_seed_user) {
    throw new Error(
      "Tato nabídka je ukázková. Přidej svou první nabídku a pomoz rozšířit Koluj ve svém okolí."
    );
  }

  const { data: customerProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, city, latitude, longitude")
    .eq("id", customerId)
    .maybeSingle();

  const profileComplete = Boolean(
    customerProfile?.id &&
      customerProfile.full_name &&
      customerProfile.city &&
      customerProfile.latitude &&
      customerProfile.longitude
  );

  if (!profileComplete) {
    throw new Error(
      "Nejdřív dokonči profil, aby bylo jasné, s kým a kde se nabídku předává."
    );
  }

  const { data: overlappingBookings, error: overlappingBookingError } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("offer_id", offer.id)
    .eq("customer_id", customerId)
    .in("status", ["requested", "approved", "active"])
    .lte("date_from", dateTo)
    .gte("date_to", dateFrom)
    .limit(1);

  if (overlappingBookingError) {
    throw new Error(overlappingBookingError.message);
  }

  if (overlappingBookings && overlappingBookings.length > 0) {
    throw new Error("Na tuto nabídku už máš žádost ve stejném nebo překrývajícím se termínu.");
  }

  await assertOfferAvailableServer({
    offerId: offer.id,
    dateFrom,
    dateTo,
  });

  const { data: createdBooking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .insert({
      offer_id: offer.id,
      owner_id: offer.owner_id,
      customer_id: customerId,
      status: "requested",
      date_from: dateFrom,
      date_to: dateTo,
      price_amount: offer.price_amount ?? 0,
      deposit_amount: offer.deposit ?? 0,
      total_price: offer.price_amount ?? 0,
      platform_fee: 0,
      owner_earnings: offer.price_amount ?? 0,
      note: note?.trim() || null,
    })
    .select("id")
    .single();

  if (bookingError || !createdBooking) {
    throw new Error(bookingError?.message || "Žádost se nepodařilo vytvořit");
  }

  await addSystemMessage({
    bookingId: createdBooking.id,
    actorId: customerId,
    message: `Žádost o rezervace vytvořena.

Nabídka: ${offer.title}
Termín: ${formatDate(dateFrom)} – ${formatDate(dateTo)}
Místo předání: ${offer.pickup_place}
Cena: ${offer.price_amount || 0} Kč
Kauce: ${offer.deposit || 0} Kč${note?.trim() ? `\n\nPoznámka: ${note.trim()}` : ""}`,
  });

  await notifyUserServer({
    userId: offer.owner_id,
    actorId: customerId,
    offerId: offer.id,
    bookingId: createdBooking.id,
    type: "booking_requested",
    title: "Nová žádost o rezervace",
    message: `si chce rezervovat: ${offer.title}`,
    emailSubject: "Nová žádost o rezervace",
  });

  return {
    ok: true,
    bookingId: createdBooking.id,
  };
}

export async function approveBookingServer({
  bookingId,
  actorId,
}: {
  bookingId: string;
  actorId: string;
}) {
  const approvedAt = new Date().toISOString();
  const { booking, offer } = await loadBookingWithOffer(bookingId);

  if (booking.owner_id !== actorId) {
    throw new Error("Tuto rezervaci může schválit pouze vlastník");
  }

  if (booking.status !== "requested") {
    throw new Error("Schválit lze pouze novou žádost");
  }

  if (!booking.date_from || !booking.date_to) {
    throw new Error("Rezervace nemá vybraný termín.");
  }

  await assertOfferAvailableServer({
    offerId: offer.id,
    dateFrom: booking.date_from,
    dateTo: booking.date_to,
  });

  const { error: updateBookingError } = await supabaseAdmin
    .from("bookings")
    .update({ status: "approved", approved_at: approvedAt })
    .eq("id", booking.id);

  if (updateBookingError) throw new Error(updateBookingError.message);

  await createReservationForBookingServer(booking.id);

  await addSystemMessage({
    bookingId: booking.id,
    actorId,
    message:
      "Žádost byla schválena.\n\nMůžete se domluvit na termínu předání.",
  });

  await notifyUserServer({
    userId: booking.customer_id,
    actorId,
    offerId: offer.id,
    bookingId: booking.id,
    type: "booking_approved",
    title: "Rezervace schválena",
    message: `${offer.title} byla schválena. Domluvte si předání.`,
    emailSubject: "Rezervace schválena",
  });

  return { ok: true, approvedAt };
}

export async function rejectBookingServer({
  bookingId,
  actorId,
}: {
  bookingId: string;
  actorId: string;
}) {
  const { booking, offer } = await loadBookingWithOffer(bookingId);

  if (booking.owner_id !== actorId) {
    throw new Error("Tuto rezervaci může odmítnout pouze vlastník");
  }

  if (!["requested", "approved"].includes(booking.status)) {
    throw new Error("Zrušit lze pouze novou nebo schválenou žádost");
  }

  const { error: bookingError } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id);

  if (bookingError) throw new Error(bookingError.message);

  await cancelReservationForBookingServer(booking.id);

  await addSystemMessage({
    bookingId: booking.id,
    actorId,
    message: booking.status === "approved" ? "Schválená rezervace byla zrušena." : "Žádost byla odmítnuta.",
  });

  await notifyUserServer({
    userId: booking.customer_id,
    actorId,
    offerId: offer.id,
    bookingId: booking.id,
    type: "booking_rejected",
    title: "Žádost byla odmítnuta",
    message: `${offer.title} nebyla schválena k rezervaci.`,
    emailSubject: "Žádost byla odmítnuta",
  });

  return { ok: true };
}

export async function startBookingServer({
  bookingId,
  actorId,
}: {
  bookingId: string;
  actorId: string;
}) {
  const handedOverAt = new Date().toISOString();
  const { booking, offer } = await loadBookingWithOffer(bookingId);

  if (booking.owner_id !== actorId) {
    throw new Error("Předání může potvrdit pouze vlastník");
  }

  if (booking.status !== "approved") {
    throw new Error("Předání lze potvrdit pouze u schválené rezervace");
  }

  const { error: bookingError } = await supabaseAdmin
    .from("bookings")
    .update({ status: "active", handed_over_at: handedOverAt })
    .eq("id", booking.id);

  if (bookingError) throw new Error(bookingError.message);

  await addSystemMessage({
    bookingId: booking.id,
    actorId,
    message: "Nabídka byla předána. Rezervace právě probíhá.",
  });

  await notifyUserServer({
    userId: booking.customer_id,
    actorId,
    offerId: offer.id,
    bookingId: booking.id,
    type: "booking_started",
    title: "Rezervace začala",
    message: `${offer.title} byla označena jako předaná.`,
    emailSubject: "Rezervace začala",
  });

  return { ok: true, handedOverAt };
}

export async function returnBookingServer({
  bookingId,
  actorId,
}: {
  bookingId: string;
  actorId: string;
}) {
  const returnedAt = new Date().toISOString();
  const { booking, offer } = await loadBookingWithOffer(bookingId);

  if (booking.owner_id !== actorId) {
    throw new Error("Vrácení může potvrdit pouze vlastník");
  }

  if (booking.status !== "active") {
    throw new Error("Vrácení lze potvrdit pouze u probíhající rezervace");
  }

  const { error: bookingError } = await supabaseAdmin
    .from("bookings")
    .update({ status: "returned", returned_at: returnedAt })
    .eq("id", booking.id);

  if (bookingError) throw new Error(bookingError.message);

  await finishReservationForBookingServer(booking.id);

  await addSystemMessage({
    bookingId: booking.id,
    actorId,
    message: "Nabídka byla vrácena. Rezervace byla ukončena.",
  });

  await notifyUserServer({
    userId: booking.customer_id,
    actorId,
    offerId: offer.id,
    bookingId: booking.id,
    type: "booking_returned",
    title: "Rezervace ukončena",
    message: `${offer.title} byla označena jako vrácená.`,
    emailSubject: "Rezervace ukončena",
  });

  const watchersNotified = await notifyAvailabilityWatchers({
    offerId: offer.id,
    actorId,
  });

  return { ok: true, returnedAt, watchersNotified };
}

export async function sendBookingMessageServer({
  bookingId,
  actorId,
  message,
}: {
  bookingId: string;
  actorId: string;
  message: string;
}) {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    throw new Error("Zpráva je prázdná");
  }

  if (containsForbiddenText(trimmedMessage)) {
    throw new Error("Zpráva obsahuje nepovolený obsah.");
  }

  const { booking, offer } = await loadBookingWithOffer(bookingId);

  if (booking.owner_id !== actorId && booking.customer_id !== actorId) {
    throw new Error("Nemáš přístup k této rezervaci");
  }

  if (booking.status === "returned" || booking.status === "cancelled") {
    throw new Error("Do ukončené rezervace už nelze psát.");
  }

  const { data: createdMessage, error: messageError } = await supabaseAdmin
    .from("booking_messages")
    .insert({
      booking_id: booking.id,
      sender_id: actorId,
      message: trimmedMessage,
      is_system: false,
    })
    .select("id")
    .single();

  if (messageError || !createdMessage) {
    throw new Error(messageError?.message || "Zprávu se nepodařilo odeslat");
  }

  const recipientId =
    booking.owner_id === actorId ? booking.customer_id : booking.owner_id;

  let recipientIsActive = false;

  if (recipientId) {
    const { data: presence } = await supabaseAdmin
      .from("booking_participant_presence")
      .select("last_seen_at")
      .eq("booking_id", booking.id)
      .eq("user_id", recipientId)
      .maybeSingle();

    recipientIsActive = Boolean(
      presence?.last_seen_at &&
        Date.now() - new Date(presence.last_seen_at).getTime() <
          10000
    );
  }

  if (recipientId) {
    await notifyUserServer({
      userId: recipientId,
      actorId,
      offerId: offer.id,
      bookingId: booking.id,
      type: "new_message",
      title: "Nová zpráva",
      message: `poslal(a) zprávu k rezervaci: ${offer.title}`,
      emailSubject: "Nová zpráva",
      sendEmail: !recipientIsActive,
      sendPush: !recipientIsActive,
    });
  }

  return {
    ok: true,
    messageId: createdMessage.id,
  };
}