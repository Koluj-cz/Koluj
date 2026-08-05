import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";
import { replaceSearchIntentChildren } from "@/lib/services/searchIntentAdminService";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const slug = String(body?.slug || "").trim().toLowerCase();
    if (!name || !slug) throw new Error("Vyplň název a slug.");

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("search_intents")
      .update({
        name,
        slug,
        description: String(body?.description || "").trim() || null,
        is_active: body?.isActive !== false,
        priority: Number(body?.priority || 0),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;

    const [{ error: keywordError }, { error: recommendationError }] = await Promise.all([
      supabase.from("search_intent_keywords").delete().eq("intent_id", id),
      supabase.from("search_intent_recommendations").delete().eq("intent_id", id),
    ]);
    if (keywordError) throw keywordError;
    if (recommendationError) throw recommendationError;

    await replaceSearchIntentChildren(supabase, id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Záměr se nepodařilo uložit";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { error } = await createSupabaseAdminClient()
      .from("search_intents")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Záměr se nepodařilo smazat";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
