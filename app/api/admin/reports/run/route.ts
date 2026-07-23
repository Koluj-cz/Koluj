import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/services/adminAccess";
import { sendMonthlyManagementReport } from "@/lib/services/monthlyManagementReportService";

export async function POST() {
  try {
    await requireAdmin();
    const result = await sendMonthlyManagementReport({ force: true });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report se nepodařilo vytvořit";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
