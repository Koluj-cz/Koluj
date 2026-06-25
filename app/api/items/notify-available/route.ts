import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyUserServer } from "@/lib/notifyUserServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { itemId, actorId } = await request.json();

  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from("items")
    .select("id, title, owner_id")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const { data: watchers, error: watchersError } = await supabaseAdmin
    .from("item_availability_watchers")
    .select("user_id")
    .eq("item_id", itemId)
    .is("notified_at", null);

  if (watchersError) {
    return NextResponse.json({ error: watchersError.message }, { status: 500 });
  }

  const recipients = (watchers || []).filter(
    (watcher) => watcher.user_id !== item.owner_id
  );

  for (const watcher of recipients) {
    await notifyUserServer({
      userId: watcher.user_id,
      actorId: actorId || item.owner_id,
      itemId: item.id,
      type: "item_available",
      title: "Věc je znovu dostupná",
      message: `${item.title} je opět k půjčení.`,
      emailSubject: "Věc je znovu dostupná",
      url: `/items/${item.id}`,
    });
  }

  if (recipients.length > 0) {
    await supabaseAdmin
      .from("item_availability_watchers")
      .update({ notified_at: new Date().toISOString() })
      .eq("item_id", itemId)
      .is("notified_at", null);
  }

  return NextResponse.json({
    ok: true,
    notified: recipients.length,
  });
}