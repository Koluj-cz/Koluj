import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";
import type { BookingIssueStatus } from "@/lib/services/bookingIssueShared";

const STATUSES = new Set<BookingIssueStatus>(["new", "in_progress", "resolved"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const status = String(body?.status || "") as BookingIssueStatus;
    if (!STATUSES.has(status)) throw new Error("Neplatný stav");

    const { error } = await createSupabaseAdminClient()
      .from("booking_issues")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stav se nepodařilo změnit";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
