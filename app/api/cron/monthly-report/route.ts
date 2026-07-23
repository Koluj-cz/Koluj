import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { sendMonthlyManagementReport } from "@/lib/services/monthlyManagementReportService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const result = await sendMonthlyManagementReport({ force });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Monthly management report cron error:", error);
    return NextResponse.json(
      { error: errorMessage(error, "Monthly management report failed") },
      { status: 500 },
    );
  }
}
