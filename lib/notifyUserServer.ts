import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import webpush from "web-push";
import { escapeHtml } from "@/lib/security";

const KOLUJ_GREEN = "#16A34A";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

function getHttpStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return null;
}

type NotifyUserServerParams = {
  userId: string | null;
  actorId: string | null;
  bookingId?: string | null;
  offerId?: string | null;
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
  bookingId,
  offerId,
  type,
  title,
  message,
  emailSubject,
  sendEmail = true,
  sendPush = true,
  url,
}: NotifyUserServerParams) {
  if (!userId) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  const targetUrl =
    url ||
    (bookingId
      ? `/dashboard/bookings/${bookingId}`
      : offerId
        ? `/offers/${offerId}`
        : "/dashboard/notifications");

  const fullUrl = `${appUrl}${targetUrl}`;

  let actorName = "Koluj";

  if (actorId) {
    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", actorId)
      .single();

    actorName = actorProfile?.full_name || "Uživatel";
  }

  const notificationMessage =
    actorId && actorName !== "Uživatel"
      ? `${actorName} ${message}`
      : message;

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    booking_id: bookingId,
    offer_id: offerId,
    type,
    title,
    message: notificationMessage,
  });

  if (sendPush) {
    const vapidEmail = process.env.VAPID_EMAIL;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (vapidEmail && vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(
        vapidEmail,
        vapidPublicKey,
        vapidPrivateKey
      );

      const { data: subscriptions } = await supabaseAdmin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userId);

      await Promise.all(
        (subscriptions || []).map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              JSON.stringify({
                title,
                body: notificationMessage,
                url: targetUrl,
              })
            );
          } catch (error) {
            const statusCode = getHttpStatusCode(error);

            if (statusCode === 404 || statusCode === 410) {
              await supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .eq("id", subscription.id);
            }

            console.error("Push send error:", error);
          }
        })
      );
    }
  }

  if (!sendEmail) return;

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

  const buttonText = bookingId
    ? "Otevřít rezervaci"
    : offerId
      ? "Otevřít nabídku"
      : "Otevřít notifikace";

  const safeMessage = escapeHtml(notificationMessage);
  const safeTitle = escapeHtml(emailSubject || title);
  const safeButtonText = escapeHtml(buttonText);
  const safeFullUrl = escapeHtml(fullUrl);

  await resend.emails.send({
    from: "Koluj <noreply@koluj.cz>",
    to: recipientEmail,
    subject: safeTitle,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h1 style="color:${KOLUJ_GREEN}; margin:0 0 24px 0;">Koluj</h1>

        <p style="font-size:16px; margin:0 0 16px 0;">
          ${safeMessage}
        </p>

        <p style="margin:0;">
          <a href="${safeFullUrl}" style="display:inline-block;background:${KOLUJ_GREEN};color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:bold;">
            ${safeButtonText}
          </a>
        </p>
      </div>
    `,
  });
}
