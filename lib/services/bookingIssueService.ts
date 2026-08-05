import { Resend } from "resend";
import { escapeHtml } from "@/lib/security";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  createBookingAttachmentSignedUrl,
  uploadBookingAttachment,
} from "@/lib/services/bookingAttachmentService";

import {
  BOOKING_ISSUE_LABELS,
  isBookingIssueType,
} from "@/lib/services/bookingIssueShared";

export async function createBookingIssue(params: {
  bookingId: string;
  reporterId: string;
  issueType: string;
  description: string;
  attachment: File | null;
}) {
  const supabase = createSupabaseAdminClient();
  const issueType = params.issueType.trim();
  const description = params.description.trim();

  if (!isBookingIssueType(issueType)) throw new Error("Vyber typ problému");
  if (description.length < 10) throw new Error("Popiš problém alespoň 10 znaky");
  if (description.length > 2000) throw new Error("Popis může mít maximálně 2000 znaků");

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, owner_id, customer_id, offers(id,title)")
    .eq("id", params.bookingId)
    .single();

  if (bookingError || !booking) throw new Error("Rezervace nebyla nalezena");
  if (booking.owner_id !== params.reporterId && booking.customer_id !== params.reporterId) {
    throw new Error("K této rezervaci nemáš přístup");
  }

  let attachmentData: Awaited<ReturnType<typeof uploadBookingAttachment>> | null = null;
  if (params.attachment) {
    attachmentData = await uploadBookingAttachment({
      bookingId: params.bookingId,
      userId: params.reporterId,
      file: params.attachment,
    });
  }

  const { data: issue, error: insertError } = await supabase
    .from("booking_issues")
    .insert({
      booking_id: params.bookingId,
      reporter_id: params.reporterId,
      issue_type: issueType,
      description,
      status: "new",
      ...(attachmentData || {}),
    })
    .select("id,created_at")
    .single();

  if (insertError || !issue) throw new Error(insertError?.message || "Problém se nepodařilo uložit");

  const [{ data: reporter }, { data: owner }, { data: customer }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", params.reporterId).maybeSingle(),
    booking.owner_id
      ? supabase.from("profiles").select("full_name,email").eq("id", booking.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    booking.customer_id
      ? supabase.from("profiles").select("full_name,email").eq("id", booking.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const offerValue = booking.offers as { id?: string; title?: string } | { id?: string; title?: string }[] | null;
  const offer = Array.isArray(offerValue) ? offerValue[0] : offerValue;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.koluj.cz").replace(/\/$/, "");
  const adminUrl = `${appUrl}/dashboard/admin/issues`;
  const recipient = process.env.ISSUE_REPORT_RECIPIENT || "info@koluj.cz";

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const safeDescription = escapeHtml(description).replace(/\n/g, "<br>");
    const { error: emailError } = await resend.emails.send({
      from: "Koluj <noreply@koluj.cz>",
      to: recipient,
      subject: `Nový problém u rezervace: ${BOOKING_ISSUE_LABELS[issueType]}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:680px;margin:auto">
          <h1 style="color:#16a34a">Koluj – nahlášený problém</h1>
          <p><strong>Typ:</strong> ${escapeHtml(BOOKING_ISSUE_LABELS[issueType])}</p>
          <p><strong>Nabídka:</strong> ${escapeHtml(offer?.title || "Bez názvu")}</p>
          <p><strong>ID rezervace:</strong> ${escapeHtml(params.bookingId)}</p>
          <p><strong>Nahlásil:</strong> ${escapeHtml(reporter?.full_name || reporter?.email || params.reporterId)}</p>
          <p><strong>Vlastník:</strong> ${escapeHtml(owner?.full_name || owner?.email || "Neuveden")}</p>
          <p><strong>Zájemce:</strong> ${escapeHtml(customer?.full_name || customer?.email || "Neuveden")}</p>
          <div style="padding:16px;border-radius:14px;background:#f8fafc;margin:20px 0">${safeDescription}</div>
          <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#16a34a;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:bold">Otevřít nahlášené problémy</a>
        </div>
      `,
    });
    if (emailError) console.error("Booking issue email error:", emailError);
  } else {
    console.warn("RESEND_API_KEY is missing; booking issue email was not sent.");
  }

  return { id: issue.id, createdAt: issue.created_at };
}

export async function getBookingIssueAttachmentUrl(path: string | null) {
  return path ? createBookingAttachmentSignedUrl(path) : null;
}
