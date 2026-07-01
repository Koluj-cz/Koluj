import { NextResponse } from "next/server";
import { sendBookingRemindersServer } from "@/lib/services/bookingReminderService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  try {
    const result = await sendBookingRemindersServer();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Booking reminders cron error:", error);

    return NextResponse.json(
      { error: error.message || "Booking reminders failed" },
      { status: 500 }
    );
  }
}