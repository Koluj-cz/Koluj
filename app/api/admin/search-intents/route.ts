import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";
import { replaceSearchIntentChildren } from "@/lib/services/searchIntentAdminService";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const slug = String(body?.slug || "").trim().toLowerCase();
    if (!name || !slug) throw new Error("Vyplň název a slug.");

    const supabase = createSupabaseAdminClient();
    const { data: intent, error } = await supabase
      .from("search_intents")
      .insert({
        name,
        slug,
        description: String(body?.description || "").trim() || null,
        is_active: body?.isActive !== false,
        priority: Number(body?.priority || 0),
      })
      .select("id")
      .single();
    if (error) throw error;

    await replaceSearchIntentChildren(supabase, intent.id, body);
    return NextResponse.json({ ok: true, id: intent.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Záměr se nepodařilo vytvořit";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
