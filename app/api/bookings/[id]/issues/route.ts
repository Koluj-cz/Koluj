import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { createBookingIssue } from "@/lib/services/bookingIssueService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rate = await checkRateLimit({
    key: `booking-issue:${id}:${getClientIp(request)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const formData = await request.formData();
    const attachmentValue = formData.get("attachment");
    const attachment = attachmentValue instanceof File && attachmentValue.size > 0
      ? attachmentValue
      : null;

    const result = await createBookingIssue({
      bookingId: id,
      reporterId: user.id,
      issueType: String(formData.get("issueType") || ""),
      description: String(formData.get("description") || ""),
      attachment,
    });

    return NextResponse.json({ ok: true, issue: result });
  } catch (error) {
    const message = errorMessage(error, "Problém se nepodařilo odeslat");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
