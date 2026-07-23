import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    if (id === admin.id) return NextResponse.json({ error: "Vlastní účet nelze zablokovat." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const banned = Boolean(body?.banned);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.updateUserById(id, {
      ban_duration: banned ? "876000h" : "none",
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, banned, userId: data.user.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Akce selhala";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
