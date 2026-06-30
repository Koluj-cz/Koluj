import { createClient } from "@supabase/supabase-js";
import { notifyUserServer } from "@/lib/notifyUserServer";
import { containsForbiddenText } from "@/lib/moderation";
import {
  assertItemAvailableServer,
  cancelReservationForLoanServer,
  createReservationForLoanServer,
  finishReservationForLoanServer,
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
  loanId,
  actorId,
  message,
}: {
  loanId: string;
  actorId: string;
  message: string;
}) {
  const { error } = await supabaseAdmin.from("loan_messages").insert({
    loan_id: loanId,
    sender_id: actorId,
    is_system: true,
    message,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function loadLoanWithItem(loanId: string) {
  const { data: loan, error: loanError } = await supabaseAdmin
    .from("loans")
    .select("id, owner_id, borrower_id, item_id, status, date_from, date_to")
    .eq("id", loanId)
    .single();

  if (loanError || !loan) {
    throw new Error("Půjčka nebyla nalezena");
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from("items")
    .select("id, title, status")
    .eq("id", loan.item_id)
    .single();

  if (itemError || !item) {
    throw new Error("Věc nebyla nalezena");
  }

  return { loan, item };
}

async function notifyAvailabilityWatchers({
  itemId,
  actorId,
}: {
  itemId: string;
  actorId: string;
}) {
  const { data: item, error: itemError } = await supabaseAdmin
    .from("items")
    .select("id, title, owner_id")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    throw new Error("Věc nebyla nalezena");
  }

  const { data: watchers, error: watchersError } = await supabaseAdmin
    .from("item_availability_watchers")
    .select("user_id")
    .eq("item_id", itemId)
    .is("notified_at", null);

  if (watchersError) {
    throw new Error(watchersError.message);
  }

  const recipients = (watchers || []).filter(
    (watcher) => watcher.user_id !== item.owner_id
  );

  for (const watcher of recipients) {
    await notifyUserServer({
      userId: watcher.user_id,
      actorId,
      itemId: item.id,
      type: "item_available",
      title: "Věc je znovu dostupná",
      message: `${item.title} je opět k půjčení.`,
      emailSubject: "Věc je znovu dostupná",
      url: `/items/${item.id}`,
    });
  }

  if (recipients.length > 0) {
    await supabaseAdmin
      .from("item_availability_watchers")
      .update({ notified_at: new Date().toISOString() })
      .eq("item_id", itemId)
      .is("notified_at", null);
  }

  return recipients.length;
}

export async function requestLoanServer({
  itemId,
  borrowerId,
  dateFrom,
  dateTo,
  note,
}: {
  itemId: string;
  borrowerId: string;
  dateFrom: string;
  dateTo: string;
  note?: string;
}) {
  if (!dateFrom || !dateTo) {
    throw new Error("Vyber termín půjčení.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);

  if (fromDate < today) {
    throw new Error("Datum půjčení nemůže být v minulosti.");
  }

  if (toDate < fromDate) {
    throw new Error("Datum vrácení nemůže být dřív než datum půjčení.");
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from("items")
    .select(`
      id,
      owner_id,
      title,
      status,
      pickup_place,
      price_amount,
      deposit,
      profiles:profiles!items_owner_id_fkey (
        is_seed_user
      )
    `)
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    throw new Error("Věc nebyla nalezena");
  }

  if (item.owner_id === borrowerId) {
    throw new Error("Vlastní věc si nemůžeš půjčit");
  }

  const profile = Array.isArray(item.profiles)
    ? item.profiles[0]
    : item.profiles;

  if (profile?.is_seed_user) {
    throw new Error(
      "Tato nabídka je ukázková. Přidej svou první věc a pomoz rozšířit Koluj ve svém okolí."
    );
  }

  const { data: borrowerProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, city, latitude, longitude")
    .eq("id", borrowerId)
    .maybeSingle();

  const profileComplete = Boolean(
    borrowerProfile?.id &&
      borrowerProfile.full_name &&
      borrowerProfile.city &&
      borrowerProfile.latitude &&
      borrowerProfile.longitude
  );

  if (!profileComplete) {
    throw new Error(
      "Nejdřív dokonči profil, aby bylo jasné, s kým a kde se věc předává."
    );
  }

  const { data: existingLoans, error: existingLoanError } = await supabaseAdmin
    .from("loans")
    .select("id")
    .eq("item_id", item.id)
    .eq("borrower_id", borrowerId)
    .in("status", ["requested", "approved", "active"])
    .limit(1);

  if (existingLoanError) {
    throw new Error(existingLoanError.message);
  }

  if (existingLoans && existingLoans.length > 0) {
    throw new Error("O tuhle věc už máš aktivní žádost");
  }

  await assertItemAvailableServer({
    itemId: item.id,
    dateFrom,
    dateTo,
  });

  const { data: createdLoan, error: loanError } = await supabaseAdmin
    .from("loans")
    .insert({
      item_id: item.id,
      owner_id: item.owner_id,
      borrower_id: borrowerId,
      status: "requested",
      date_from: dateFrom,
      date_to: dateTo,
      price_amount: item.price_amount ?? 0,
      deposit_amount: item.deposit ?? 0,
      total_price: item.price_amount ?? 0,
      platform_fee: 0,
      owner_earnings: item.price_amount ?? 0,
      note: note?.trim() || null,
    })
    .select("id")
    .single();

  if (loanError || !createdLoan) {
    throw new Error(loanError?.message || "Žádost se nepodařilo vytvořit");
  }

  await addSystemMessage({
    loanId: createdLoan.id,
    actorId: borrowerId,
    message: `Žádost o půjčení vytvořena.

Věc: ${item.title}
Termín: ${formatDate(dateFrom)} – ${formatDate(dateTo)}
Místo předání: ${item.pickup_place}
Cena: ${item.price_amount || 0} Kč
Kauce: ${item.deposit || 0} Kč${note?.trim() ? `\n\nPoznámka: ${note.trim()}` : ""}`,
  });

  await notifyUserServer({
    userId: item.owner_id,
    actorId: borrowerId,
    itemId: item.id,
    loanId: createdLoan.id,
    type: "loan_requested",
    title: "Nová žádost o půjčení",
    message: `si chce půjčit: ${item.title}`,
    emailSubject: "Nová žádost o půjčení",
  });

  return {
    ok: true,
    loanId: createdLoan.id,
  };
}

export async function approveLoanServer({
  loanId,
  actorId,
}: {
  loanId: string;
  actorId: string;
}) {
  const approvedAt = new Date().toISOString();
  const { loan, item } = await loadLoanWithItem(loanId);

  if (loan.owner_id !== actorId) {
    throw new Error("Tuto půjčku může schválit pouze vlastník");
  }

  if (loan.status !== "requested") {
    throw new Error("Schválit lze pouze novou žádost");
  }

  if (!loan.date_from || !loan.date_to) {
    throw new Error("Půjčka nemá vybraný termín.");
  }

  await assertItemAvailableServer({
    itemId: item.id,
    dateFrom: loan.date_from,
    dateTo: loan.date_to,
  });

  const { error: updateLoanError } = await supabaseAdmin
    .from("loans")
    .update({ status: "approved", approved_at: approvedAt })
    .eq("id", loan.id);

  if (updateLoanError) throw new Error(updateLoanError.message);

  await createReservationForLoanServer(loan.id);

  await addSystemMessage({
    loanId: loan.id,
    actorId,
    message:
      "Žádost byla schválena.\n\nMůžete se domluvit na termínu předání.",
  });

  await notifyUserServer({
    userId: loan.borrower_id,
    actorId,
    itemId: item.id,
    loanId: loan.id,
    type: "loan_approved",
    title: "Půjčka schválena",
    message: `${item.title} byla schválena. Domluvte si předání.`,
    emailSubject: "Půjčka schválena",
  });

  return { ok: true, approvedAt };
}

export async function rejectLoanServer({
  loanId,
  actorId,
}: {
  loanId: string;
  actorId: string;
}) {
  const { loan, item } = await loadLoanWithItem(loanId);

  if (loan.owner_id !== actorId) {
    throw new Error("Tuto půjčku může odmítnout pouze vlastník");
  }

  if (!["requested", "approved"].includes(loan.status)) {
    throw new Error("Zrušit lze pouze novou nebo schválenou žádost");
  }

  const { error: loanError } = await supabaseAdmin
    .from("loans")
    .update({ status: "cancelled" })
    .eq("id", loan.id);

  if (loanError) throw new Error(loanError.message);

  await cancelReservationForLoanServer(loan.id);

  await addSystemMessage({
    loanId: loan.id,
    actorId,
    message: loan.status === "approved" ? "Schválená půjčka byla zrušena." : "Žádost byla odmítnuta.",
  });

  await notifyUserServer({
    userId: loan.borrower_id,
    actorId,
    itemId: item.id,
    loanId: loan.id,
    type: "loan_rejected",
    title: "Žádost byla odmítnuta",
    message: `${item.title} nebyla schválena k půjčení.`,
    emailSubject: "Žádost byla odmítnuta",
  });

  return { ok: true };
}

export async function startLoanServer({
  loanId,
  actorId,
}: {
  loanId: string;
  actorId: string;
}) {
  const handedOverAt = new Date().toISOString();
  const { loan, item } = await loadLoanWithItem(loanId);

  if (loan.owner_id !== actorId) {
    throw new Error("Předání může potvrdit pouze vlastník");
  }

  if (loan.status !== "approved") {
    throw new Error("Předání lze potvrdit pouze u schválené půjčky");
  }

  const { error: loanError } = await supabaseAdmin
    .from("loans")
    .update({ status: "active", handed_over_at: handedOverAt })
    .eq("id", loan.id);

  if (loanError) throw new Error(loanError.message);

  await addSystemMessage({
    loanId: loan.id,
    actorId,
    message: "Věc byla předána. Půjčka právě probíhá.",
  });

  await notifyUserServer({
    userId: loan.borrower_id,
    actorId,
    itemId: item.id,
    loanId: loan.id,
    type: "loan_started",
    title: "Půjčka začala",
    message: `${item.title} byla označena jako předaná.`,
    emailSubject: "Půjčka začala",
  });

  return { ok: true, handedOverAt };
}

export async function returnLoanServer({
  loanId,
  actorId,
}: {
  loanId: string;
  actorId: string;
}) {
  const returnedAt = new Date().toISOString();
  const { loan, item } = await loadLoanWithItem(loanId);

  if (loan.owner_id !== actorId) {
    throw new Error("Vrácení může potvrdit pouze vlastník");
  }

  if (loan.status !== "active") {
    throw new Error("Vrácení lze potvrdit pouze u probíhající půjčky");
  }

  const { error: loanError } = await supabaseAdmin
    .from("loans")
    .update({ status: "returned", returned_at: returnedAt })
    .eq("id", loan.id);

  if (loanError) throw new Error(loanError.message);

  await finishReservationForLoanServer(loan.id);

  await addSystemMessage({
    loanId: loan.id,
    actorId,
    message: "Věc byla vrácena. Půjčka byla ukončena.",
  });

  await notifyUserServer({
    userId: loan.borrower_id,
    actorId,
    itemId: item.id,
    loanId: loan.id,
    type: "loan_returned",
    title: "Půjčka ukončena",
    message: `${item.title} byla označena jako vrácená.`,
    emailSubject: "Půjčka ukončena",
  });

  const watchersNotified = await notifyAvailabilityWatchers({
    itemId: item.id,
    actorId,
  });

  return { ok: true, returnedAt, watchersNotified };
}

export async function sendLoanMessageServer({
  loanId,
  actorId,
  message,
}: {
  loanId: string;
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

  const { loan, item } = await loadLoanWithItem(loanId);

  if (loan.owner_id !== actorId && loan.borrower_id !== actorId) {
    throw new Error("Nemáš přístup k této půjčce");
  }

  if (loan.status === "returned" || loan.status === "cancelled") {
    throw new Error("Do ukončené půjčky už nelze psát.");
  }

  const { data: createdMessage, error: messageError } = await supabaseAdmin
    .from("loan_messages")
    .insert({
      loan_id: loan.id,
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
    loan.owner_id === actorId ? loan.borrower_id : loan.owner_id;

  let recipientIsActive = false;

  if (recipientId) {
    const { data: presence } = await supabaseAdmin
      .from("loan_participant_presence")
      .select("last_seen_at")
      .eq("loan_id", loan.id)
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
      itemId: item.id,
      loanId: loan.id,
      type: "new_message",
      title: "Nová zpráva",
      message: `poslal(a) zprávu k půjčce: ${item.title}`,
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