import { createClient } from "@supabase/supabase-js";
import { notifyUserServer } from "@/lib/notifyUserServer";
import { containsForbiddenText } from "@/lib/moderation";
import { isServiceIntervalInsideOpeningHours } from "@/lib/serviceBookingRules";
import {
  removeBookingAttachment,
  uploadBookingAttachment,
} from "@/lib/services/bookingAttachmentService";
import {
  assertOfferAvailableServer,
  assertOfferDateNotBlockedServer,
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

function formatDateTime(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toIsoDate(date: string) {
  return new Date(date).toISOString().split("T")[0];
}

function calculateBookingPrice({
  offerType,
  priceUnit,
  priceAmount,
  startsAt,
  endsAt,
}: {
  offerType: string | null;
  priceUnit: string | null;
  priceAmount: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  const amount = Number(priceAmount || 0);

  if (offerType === "service" && priceUnit === "individual") {
    return 0;
  }

  if (offerType === "service" && priceUnit === "hour" && startsAt && endsAt) {
    const minutes = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000;
    return Math.max(0, Math.round(amount * (minutes / 60) * 100) / 100);
  }

  return amount;
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
    .select("id, owner_id, customer_id, offer_id, status, date_from, date_to, starts_at, ends_at")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    throw new Error("Rezervace nebyla nalezena");
  }

  const { data: offer, error: offerError } = await supabaseAdmin
    .from("offers")
    .select("id, title, status, offer_type, price_unit, service_booking_mode")
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
  startsAt,
  endsAt,
  note,
  attachment,
}: {
  offerId: string;
  customerId: string;
  dateFrom?: string;
  dateTo?: string;
  startsAt?: string;
  endsAt?: string;
  note?: string;
  attachment?: File | null;
}) {

  const { data: offer, error: offerError } = await supabaseAdmin
    .from("offers")
    .select(`
      id,
      owner_id,
      title,
      status,
      publication_status,
      hidden_by_account_deactivation,
      offer_type,
      pickup_place,
      price_amount,
      price_unit,
      deposit,
      service_booking_mode,
      service_hours_mode,
      weekday_start_time,
      weekday_end_time,
      weekend_start_time,
      weekend_end_time,
      profiles:profiles!offers_owner_id_fkey (
        is_seed_user,
        is_deactivated
      )
    `)
    .eq("id", offerId)
    .single();

  if (offerError || !offer) {
    throw new Error("Nabídka nebyla nalezena");
  }

  if (
    offer.publication_status !== "active" ||
    offer.hidden_by_account_deactivation
  ) {
    throw new Error("Tato nabídka momentálně není dostupná");
  }

  if (offer.owner_id === customerId) {
    throw new Error("Vlastní nabídku si nemůžeš rezervovat");
  }

  const profile = Array.isArray(offer.profiles)
    ? offer.profiles[0]
    : offer.profiles;

  if (profile?.is_deactivated) {
    throw new Error("Tato nabídka momentálně není dostupná");
  }

  if (profile?.is_seed_user) {
    throw new Error(
      "Tato nabídka je ukázková. Přidej svou první nabídku a pomoz rozšířit Koluj ve svém okolí."
    );
  }

  const isService = offer.offer_type === "service";
  const serviceBookingMode = offer.service_booking_mode === "deadline" ? "deadline" : "scheduled";
  const isTimedService = isService && serviceBookingMode === "scheduled";
  const isDeadlineService = isService && serviceBookingMode === "deadline";

  if (isTimedService) {
    if (!startsAt || !endsAt) {
      throw new Error("Vyber den a čas služby.");
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Vybraný čas není platný.");
    }

    if (start < new Date()) {
      throw new Error("Čas rezervace nemůže být v minulosti.");
    }

    if (end <= start) {
      throw new Error("Konec rezervace musí být později než začátek.");
    }

    if (!isServiceIntervalInsideOpeningHours(offer, startsAt, endsAt)) {
      throw new Error("Vybraný čas je mimo provozní dobu služby.");
    }

    dateFrom = toIsoDate(startsAt);
    dateTo = toIsoDate(endsAt);
  } else if (isDeadlineService) {
    startsAt = undefined;
    endsAt = undefined;

    if (!dateFrom) {
      throw new Error("Vyber požadovaný termín dokončení.");
    }

    dateTo = dateFrom;
    const deadline = new Date(`${dateFrom}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (deadline < today) {
      throw new Error("Termín dokončení nemůže být v minulosti.");
    }
  } else {
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

  const overlappingBookingsQuery = supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("offer_id", offer.id)
    .eq("customer_id", customerId)
    .in("status", ["requested", "approved", "active"]);

  const { data: overlappingBookings, error: overlappingBookingError } = isTimedService
    ? await overlappingBookingsQuery
        .not("starts_at", "is", null)
        .lt("starts_at", endsAt!)
        .gt("ends_at", startsAt!)
        .limit(1)
    : isDeadlineService
    ? await overlappingBookingsQuery
        .lte("date_from", dateTo!)
        .gte("date_to", dateFrom!)
        .limit(1)
    : await overlappingBookingsQuery
        .lte("date_from", dateTo!)
        .gte("date_to", dateFrom!)
        .limit(1);

  if (overlappingBookingError) {
    throw new Error(overlappingBookingError.message);
  }

  if (overlappingBookings && overlappingBookings.length > 0) {
    throw new Error("Na tuto nabídku už máš žádost ve stejném nebo překrývajícím se termínu.");
  }

  if (isDeadlineService) {
    await assertOfferDateNotBlockedServer({
      offerId: offer.id,
      dateFrom,
      dateTo,
    });
  } else if (!isService || isTimedService) {
    await assertOfferAvailableServer({
      offerId: offer.id,
      dateFrom,
      dateTo,
      startsAt: isTimedService ? startsAt : null,
      endsAt: isTimedService ? endsAt : null,
    });
  }

  const totalPrice = calculateBookingPrice({
    offerType: offer.offer_type,
    priceUnit: offer.price_unit,
    priceAmount: offer.price_amount,
    startsAt: isTimedService ? startsAt : null,
    endsAt: isTimedService ? endsAt : null,
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
      starts_at: isTimedService ? startsAt : null,
      ends_at: isTimedService ? endsAt : null,
      price_amount: offer.price_amount ?? 0,
      deposit_amount: isService ? 0 : offer.deposit ?? 0,
      total_price: totalPrice,
      platform_fee: 0,
      owner_earnings: totalPrice,
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
    message: `${isService ? "Žádost o službu vytvořena." : "Žádost o rezervaci vytvořena."}

Nabídka: ${offer.title}
${isTimedService ? `Čas: ${formatDateTime(startsAt || null)} – ${formatDateTime(endsAt || null)}\n` : isDeadlineService ? `Termín dokončení: ${formatDate(dateFrom || null)}\n` : !isService ? `Termín: ${formatDate(dateFrom || null)} – ${formatDate(dateTo || null)}\n` : "Termín: domluvou\n"}${isService ? "Lokalita působení" : "Místo předání"}: ${offer.pickup_place}
Cena: ${offer.price_unit === "individual" ? "individuálně" : `${totalPrice} Kč`}${!isService ? `\nKauce: ${offer.deposit || 0} Kč` : ""}${note?.trim() ? `\n\nPoznámka: ${note.trim()}` : ""}`,
  });

  if (attachment) {
    let uploadedPath: string | null = null;

    try {
      const attachmentData = await uploadBookingAttachment({
        bookingId: createdBooking.id,
        userId: customerId,
        file: attachment,
      });
      uploadedPath = attachmentData.attachment_path;

      const { error: attachmentMessageError } = await supabaseAdmin
        .from("booking_messages")
        .insert({
          booking_id: createdBooking.id,
          sender_id: customerId,
          message: note?.trim() || "Příloha k žádosti",
          is_system: false,
          ...attachmentData,
        });

      if (attachmentMessageError) throw new Error(attachmentMessageError.message);
    } catch (error) {
      await removeBookingAttachment(uploadedPath);
      throw error;
    }
  }

  await notifyUserServer({
    userId: offer.owner_id,
    actorId: customerId,
    offerId: offer.id,
    bookingId: createdBooking.id,
    type: "booking_requested",
    title: isService ? "Nová poptávka služby" : "Nová žádost o rezervaci",
    message: isService ? `má zájem o službu: ${offer.title}` : `si chce rezervovat: ${offer.title}`,
    emailSubject: isService ? "Nová poptávka služby" : "Nová žádost o rezervaci",
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

  const isService = offer.offer_type === "service";
  const isTimedService = isService && Boolean(booking.starts_at && booking.ends_at);
  const isDeadlineService = isService && offer.service_booking_mode === "deadline";

  if (!isService && (!booking.date_from || !booking.date_to)) {
    throw new Error("Rezervace nemá vybraný termín.");
  }

  if (isDeadlineService) {
    await assertOfferDateNotBlockedServer({
      offerId: offer.id,
      dateFrom: booking.date_from,
      dateTo: booking.date_to,
    });
  } else if (!isService || isTimedService) {
    await assertOfferAvailableServer({
      offerId: offer.id,
      dateFrom: booking.date_from,
      dateTo: booking.date_to,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      ignoreBookingId: booking.id,
    });
  }

  const { error: updateBookingError } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "approved",
      approved_at: approvedAt,
      handed_over_at: null,
    })
    .eq("id", booking.id);

  if (updateBookingError) throw new Error(updateBookingError.message);

  if (!isService || isTimedService) {
    await createReservationForBookingServer(booking.id);
  }

  await addSystemMessage({
    bookingId: booking.id,
    actorId,
    message: isService
      ? "Poptávka služby byla schválena.\n\nDomluvte se na detailech provedení služby."
      : "Žádost byla schválena.\n\nMůžete se domluvit na termínu předání.",
  });

  await notifyUserServer({
    userId: booking.customer_id,
    actorId,
    offerId: offer.id,
    bookingId: booking.id,
    type: "booking_approved",
    title: isService ? "Služba schválena" : "Rezervace schválena",
    message: isService
      ? `${offer.title} byla schválena. Domluvte se na detailech služby.`
      : `${offer.title} byla schválena. Domluvte si předání.`,
    emailSubject: isService ? "Služba schválena" : "Rezervace schválena",
  });

  return { ok: true, approvedAt, status: "approved" };
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

  if (!(offer.offer_type === "service" ? ["requested", "approved", "active"] : ["requested", "approved"]).includes(booking.status)) {
    throw new Error(offer.offer_type === "service" ? "Zrušit lze pouze novou, schválenou nebo probíhající službu" : "Zrušit lze pouze novou nebo schválenou žádost");
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
    message: offer.offer_type === "service"
      ? (booking.status === "active" || booking.status === "approved" ? "Schválená služba byla zrušena." : "Poptávka služby byla odmítnuta.")
      : (booking.status === "approved" ? "Schválená rezervace byla zrušena." : "Žádost byla odmítnuta."),
  });

  await notifyUserServer({
    userId: booking.customer_id,
    actorId,
    offerId: offer.id,
    bookingId: booking.id,
    type: "booking_rejected",
    title: offer.offer_type === "service" ? "Poptávka služby byla odmítnuta" : "Žádost byla odmítnuta",
    message: offer.offer_type === "service"
      ? `${offer.title} nebyla schválena k provedení.`
      : `${offer.title} nebyla schválena k rezervaci.`,
    emailSubject: offer.offer_type === "service" ? "Poptávka služby byla odmítnuta" : "Žádost byla odmítnuta",
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

  if (offer.offer_type === "service") {
    throw new Error("U služby se předání nepotvrzuje. Službu označ jako dokončenou.");
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
    throw new Error(offer.offer_type === "service" ? "Dokončení může potvrdit pouze poskytovatel" : "Vrácení může potvrdit pouze vlastník");
  }

  const canFinishService =
    offer.offer_type === "service" &&
    (booking.status === "approved" || booking.status === "active");

  if (offer.offer_type === "service") {
    if (!canFinishService) {
      throw new Error("Dokončit lze pouze schválenou službu");
    }

  } else if (booking.status !== "active") {
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
    message: offer.offer_type === "service"
      ? "Služba byla označena jako dokončená. Rezervace byla ukončena."
      : "Nabídka byla vrácena. Rezervace byla ukončena.",
  });

  await notifyUserServer({
    userId: booking.customer_id,
    actorId,
    offerId: offer.id,
    bookingId: booking.id,
    type: "booking_returned",
    title: offer.offer_type === "service" ? "Služba dokončena" : "Rezervace ukončena",
    message: offer.offer_type === "service"
      ? `${offer.title} byla označena jako dokončená.`
      : `${offer.title} byla označena jako vrácená.`,
    emailSubject: offer.offer_type === "service" ? "Služba dokončena" : "Rezervace ukončena",
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
  attachment,
}: {
  bookingId: string;
  actorId: string;
  message: string;
  attachment?: File | null;
}) {
  const trimmedMessage = message.trim();

  if (!trimmedMessage && !attachment) {
    throw new Error("Napiš zprávu nebo přilož soubor");
  }

  if (trimmedMessage && containsForbiddenText(trimmedMessage)) {
    throw new Error("Zpráva obsahuje nepovolený obsah.");
  }

  const { booking, offer } = await loadBookingWithOffer(bookingId);

  if (booking.owner_id !== actorId && booking.customer_id !== actorId) {
    throw new Error("Nemáš přístup k této rezervaci");
  }

  if (booking.status === "returned" || booking.status === "cancelled") {
    throw new Error("Do ukončené rezervace už nelze psát.");
  }

  let attachmentData: Awaited<ReturnType<typeof uploadBookingAttachment>> | null = null;

  if (attachment) {
    attachmentData = await uploadBookingAttachment({
      bookingId: booking.id,
      userId: actorId,
      file: attachment,
    });
  }

  const { data: createdMessage, error: messageError } = await supabaseAdmin
    .from("booking_messages")
    .insert({
      booking_id: booking.id,
      sender_id: actorId,
      message: trimmedMessage || (attachment ? "Příloha" : ""),
      is_system: false,
      ...(attachmentData || {}),
    })
    .select("id")
    .single();

  if (messageError || !createdMessage) {
    await removeBookingAttachment(attachmentData?.attachment_path);
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
          60000
    );
  }

  if (recipientId && !recipientIsActive) {
    await notifyUserServer({
      userId: recipientId,
      actorId,
      offerId: offer.id,
      bookingId: booking.id,
      type: "new_message",
      title: "Nová zpráva",
      message: `poslal(a) zprávu k rezervaci: ${offer.title}`,
      emailSubject: "Nová zpráva",
    });
  }

  return {
    ok: true,
    messageId: createdMessage.id,
  };
}