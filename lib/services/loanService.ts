import { createClient } from "@supabase/supabase-js";
import { notifyUserServer } from "@/lib/notifyUserServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatDate(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("cs-CZ");
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

  if (item.status !== "available") {
    throw new Error("Tahle věc není momentálně dostupná");
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

  const { data: createdLoan, error: loanError } = await supabaseAdmin
    .from("loans")
    .insert({
      item_id: item.id,
      owner_id: item.owner_id,
      borrower_id: borrowerId,
      status: "requested",
      date_from: dateFrom,
      date_to: dateTo,
      price_amount: item.price_amount,
      deposit_amount: item.deposit,
      total_price: item.price_amount,
      platform_fee: 0,
      owner_earnings: item.price_amount,
    })
    .select("id")
    .single();

  if (loanError || !createdLoan) {
    throw new Error(loanError?.message || "Žádost se nepodařilo vytvořit");
  }

  await supabaseAdmin.from("loan_messages").insert({
    loan_id: createdLoan.id,
    sender_id: borrowerId,
    is_system: true,
    message: `Žádost o půjčení vytvořena.

Věc: ${item.title}
Termín: ${formatDate(dateFrom)} – ${formatDate(dateTo)}
Místo předání: ${item.pickup_place}
Cena: ${item.price_amount || 0} Kč
Kauce: ${item.deposit || 0} Kč${
      note?.trim() ? `\n\nPoznámka: ${note.trim()}` : ""
    }`,
  });

  await supabaseAdmin
    .from("items")
    .update({ status: "reserved" })
    .eq("id", item.id);

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