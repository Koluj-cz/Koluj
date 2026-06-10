import { supabase } from "@/lib/supabase";

type NotifyUserParams = {
  userId: string | null;
  actorId: string | null;
  loanId?: string | null;
  itemId?: string | null;
  type: string;
  title: string;
  message: string;
  emailSubject?: string;
  sendEmail?: boolean;
};

export async function notifyUser({
  userId,
  actorId,
  loanId,
  itemId,
  type,
  title,
  message,
  emailSubject,
  sendEmail = true,
}: NotifyUserParams) {
  if (!userId) return;

  await supabase.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    loan_id: loanId,
    item_id: itemId,
    type,
    title,
    message,
  });

  if (!sendEmail) return;

  const { data: recipientProfile } = await supabase
    .from("profiles")
    .select("email, email_notifications_enabled")
    .eq("id", userId)
    .single();

  if (
    !recipientProfile?.email ||
    !recipientProfile.email_notifications_enabled
  ) {
    return;
  }

  let actorName = "Uživatel";

  if (actorId) {
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", actorId)
      .single();

    actorName = actorProfile?.full_name || "Uživatel";
  }

  await fetch("/api/send-notification-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: recipientProfile.email,
      subject: emailSubject || title,
      actorName,
      message,
      loanId,
    }),
  });
}