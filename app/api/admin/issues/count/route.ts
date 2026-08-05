import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";

export async function GET() {
  try {
    await requireAdmin();
    const { count, error } = await createSupabaseAdminClient()
      .from("booking_issues")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    if (error) throw error;
    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Počet problémů se nepodařilo načíst";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
