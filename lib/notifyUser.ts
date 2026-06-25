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
  sendPush?: boolean;
  url?: string;
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
  sendPush = true,
  url,
}: NotifyUserParams) {
  if (!userId) return;

  const response = await fetch("/api/notifications/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      actorId,
      loanId,
      itemId,
      type,
      title,
      message,
      emailSubject,
      sendEmail,
      sendPush,
      url:
        url ||
        (loanId
          ? `/dashboard/loans/${loanId}`
          : itemId
          ? `/items/${itemId}`
          : "/dashboard/notifications"),
    }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || "Notifikaci se nepodařilo odeslat");
  }
}