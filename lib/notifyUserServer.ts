import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type NotifyUserServerParams = {
  userId: string | null;
  actorId: string | null;
  loanId?: string | null;
  itemId?: string | null;
  type: string;
  title: string;
  message: string;
  emailSubject?: string;
  sendEmail?: boolean;
  sendPush?: boolean;
  url?: string;
};

export async function notifyUserServer({
  userId,
  actorId,
  loanId,
  itemId,
  type,
  title,
  message,
  emailSubject,
  sendEmail = true,
  sendPush = true,
  url,
}: NotifyUserServerParams) {
  if (!userId) return;

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    loan_id: loanId,
    item_id: itemId,
    type,
    title,
    message,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (sendPush && appUrl) {
    await fetch(`${appUrl}/api/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET || "",
      },
      body: JSON.stringify({
        userId,
        title,
        message,
        url:
          url ||
          (loanId
            ? `/dashboard/loans/${loanId}`
            : itemId
            ? `/items/${itemId}`
            : "/dashboard/notifications"),
      }),
    });
  }

  if (!sendEmail || !appUrl) return;

  const { data: recipientProfile } = await supabaseAdmin
    .from("profiles")
    .select("email, email_notifications_enabled, is_seed_user")
    .eq("id", userId)
    .single();

  const recipientEmail = recipientProfile?.is_seed_user
    ? "info@koluj.cz"
    : recipientProfile?.email;

  if (!recipientEmail || !recipientProfile?.email_notifications_enabled) {
    return;
  }

  let actorName = "Koluj";

  if (actorId) {
    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", actorId)
      .single();

    actorName = actorProfile?.full_name || "Uživatel";
  }

  await fetch(`${appUrl}/api/send-notification-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.INTERNAL_API_SECRET || "",
    },
    body: JSON.stringify({
      to: recipientEmail,
      subject: emailSubject || title,
      actorName,
      message,
      loanId,
      itemId,
      buttonText: itemId && !loanId ? "Otevřít věc" : undefined,
    }),
  });
}