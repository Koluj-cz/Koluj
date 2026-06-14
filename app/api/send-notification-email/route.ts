import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const body = await request.json();

  const { to, subject, actorName, message, loanId } = body;

  if (!to || !subject || !message) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const loanUrl = `${appUrl}/dashboard/loans/${loanId}`;

  const { data, error } = await resend.emails.send({
    from: "Koluj <noreply@koluj.cz>",
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h1 style="color:#6b842c;">Koluj</h1>
        <p><strong>${actorName || "Uživatel"}</strong> ${message}</p>
        <p>
          <a href="${loanUrl}" style="display:inline-block;background:#6b842c;color:white;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:bold;">
            Otevřít půjčku
          </a>
        </p>
      </div>
    `,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ data });
}