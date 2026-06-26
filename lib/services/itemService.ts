import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function archiveItemServer({
  itemId,
  actorId,
}: {
  itemId: string;
  actorId: string;
}) {
  const { data: item, error: itemError } = await supabaseAdmin
    .from("items")
    .select("id, owner_id, deleted_at")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    throw new Error("Věc nebyla nalezena");
  }

  if (item.owner_id !== actorId) {
    throw new Error("Tuhle věc může archivovat pouze vlastník");
  }

  if (item.deleted_at) {
    return { ok: true };
  }

  const { error } = await supabaseAdmin
    .from("items")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
    })
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true };
}