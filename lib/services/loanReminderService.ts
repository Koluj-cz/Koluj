import { createClient } from "@supabase/supabase-js";
import { notifyUserServer } from "@/lib/notifyUserServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ReminderType = "handover_24h" | "return_24h";

type LoanReminderRow = {
  id: string;
  item_id: string;
  owner_id: string;
  borrower_id: string;
  status: string;
  date_from: string | null;
  date_to: string | null;
  items:
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
  borrower:
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

async function reserveReminderSlot(loanId: string, type: ReminderType) {
  const { error } = await supabaseAdmin.from("booking_reminders").insert({
    loan_id: loanId,
    type,
  });

  if (!error) return true;

  if (error.code === "23505") {
    return false;
  }

  throw new Error(error.message);
}

async function loadLoansForHandoverReminder(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(`
      id,
      item_id,
      owner_id,
      borrower_id,
      status,
      date_from,
      date_to,
      items:offers!loans_item_id_fkey (
        id,
        title
      ),
      owner:profiles!loans_owner_id_fkey (
        full_name
      ),
      borrower:profiles!loans_borrower_id_fkey (
        full_name
      )
    `)
    .eq("status", "approved")
    .eq("date_from", targetDate);

  if (error) throw new Error(error.message);
  return (data || []) as unknown as LoanReminderRow[];
}

async function loadLoansForReturnReminder(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(`
      id,
      item_id,
      owner_id,
      borrower_id,
      status,
      date_from,
      date_to,
      items:offers!loans_item_id_fkey (
        id,
        title
      ),
      owner:profiles!loans_owner_id_fkey (
        full_name
      ),
      borrower:profiles!loans_borrower_id_fkey (
        full_name
      )
    `)
    .eq("status", "active")
    .eq("date_to", targetDate);

  if (error) throw new Error(error.message);
  return (data || []) as unknown as LoanReminderRow[];
}

export async function sendLoanRemindersServer() {
  const targetDate = getTomorrowIsoDate();

  let handoverSent = 0;
  let returnSent = 0;

  const handoverLoans = await loadLoansForHandoverReminder(targetDate);

  for (const loan of handoverLoans) {
    const shouldSend = await reserveReminderSlot(loan.id, "handover_24h");
    if (!shouldSend) continue;

    const item = firstOrValue(loan.items);
    const owner = firstOrValue(loan.owner);
    const borrower = firstOrValue(loan.borrower);
    const itemTitle = item?.title || "nabídku";
    const ownerName = owner?.full_name || "vlastníka";
    const borrowerName = borrower?.full_name || "rezervujícího";

    await notifyUserServer({
      userId: loan.owner_id,
      actorId: null,
      loanId: loan.id,
      itemId: loan.item_id,
      type: "loan_handover_reminder_24h",
      title: "Zítra začíná rezervace",
      message: `Zítra začíná rezervace „${itemTitle}“ uživateli ${borrowerName}.`,
      emailSubject: "Připomínka začátku rezervace",
    });

    await notifyUserServer({
      userId: loan.borrower_id,
      actorId: null,
      loanId: loan.id,
      itemId: loan.item_id,
      type: "loan_handover_reminder_24h",
      title: "Zítra začíná tvoje rezervace",
      message: `Zítra začíná tvoje rezervace „${itemTitle}“ od uživatele ${ownerName}.`,
      emailSubject: "Připomínka začátku rezervace",
    });

    handoverSent += 2;
  }

  const returnLoans = await loadLoansForReturnReminder(targetDate);

  for (const loan of returnLoans) {
    const shouldSend = await reserveReminderSlot(loan.id, "return_24h");
    if (!shouldSend) continue;

    const item = firstOrValue(loan.items);
    const borrower = firstOrValue(loan.borrower);
    const itemTitle = item?.title || "nabídku";
    const borrowerName = borrower?.full_name || "rezervujícího";

    await notifyUserServer({
      userId: loan.owner_id,
      actorId: null,
      loanId: loan.id,
      itemId: loan.item_id,
      type: "loan_return_reminder_24h",
      title: "Zítra končí rezervace",
      message: `Zítra končí rezervace „${itemTitle}“ s uživatelem ${borrowerName}.`,
      emailSubject: "Připomínka konce rezervace",
    });

    await notifyUserServer({
      userId: loan.borrower_id,
      actorId: null,
      loanId: loan.id,
      itemId: loan.item_id,
      type: "loan_return_reminder_24h",
      title: "Zítra končí tvoje rezervace",
      message: `Zítra končí tvoje rezervace „${itemTitle}“.`,
      emailSubject: "Připomínka konce rezervace",
    });

    returnSent += 2;
  }

  return {
    ok: true,
    targetDate,
    handoverLoans: handoverLoans.length,
    returnLoans: returnLoans.length,
    notificationsSent: handoverSent + returnSent,
  };
}
