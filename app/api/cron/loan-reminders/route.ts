import { NextResponse } from "next/server";
import { sendLoanRemindersServer } from "@/lib/services/loanReminderService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  return NextResponse.json({
    hasCronSecret: Boolean(cronSecret),
    received: request.headers.get("authorization"),
  });

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sendLoanRemindersServer();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Loan reminders cron error:", error);

    return NextResponse.json(
      { error: error.message || "Loan reminders failed" },
      { status: 500 }
    );
  }
}
