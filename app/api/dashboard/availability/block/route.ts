import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  assertItemAvailableServer,
  normalizeDateRange,
} from "@/lib/services/availabilityService";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RequestBody = {
  dateFrom?: string;
  dateTo?: string;
  reason?: string;
  applyToAll?: boolean;
  itemIds?: string[];
};

export async function POST(request: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;

  if (!body?.dateFrom || !body?.dateTo) {
    return NextResponse.json(
      { error: "Vyber termín blokace." },
      { status: 400 }
    );
  }

  let range;

  try {
    range = normalizeDateRange(body.dateFrom, body.dateTo);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Neplatný termín." },
      { status: 400 }
    );
  }

  const applyToAll = Boolean(body.applyToAll);
  const itemIds = Array.isArray(body.itemIds)
    ? body.itemIds.filter(Boolean)
    : [];

  if (!applyToAll && itemIds.length === 0) {
    return NextResponse.json(
      { error: "Vyber alespoň jednu věc." },
      { status: 400 }
    );
  }

  let query = supabaseAdmin
    .from("items")
    .select("id, title")
    .eq("owner_id", user.id)
    .is("deleted_at", null);

  if (!applyToAll) {
    query = query.in("id", itemIds);
  }

  const { data: items, error: itemsError } = await query.order("created_at", {
    ascending: false,
  });

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: "Nenalezeny žádné věci k blokaci." },
      { status: 400 }
    );
  }

  const created: { id: string; itemId: string; title: string }[] = [];
  const skipped: { itemId: string; title: string; reason: string }[] = [];

  for (const item of items) {
    try {
      await assertItemAvailableServer({
        itemId: item.id,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      });

      const { data: block, error: blockError } = await supabaseAdmin
        .from("item_availability_blocks")
        .insert({
          item_id: item.id,
          owner_id: user.id,
          date_from: range.dateFrom,
          date_to: range.dateTo,
          reason: body.reason?.trim() || null,
        })
        .select("id")
        .single();

      if (blockError || !block) {
        skipped.push({
          itemId: item.id,
          title: item.title || "Věc",
          reason: blockError?.message || "Blokaci se nepodařilo vytvořit.",
        });
        continue;
      }

      created.push({
        id: block.id,
        itemId: item.id,
        title: item.title || "Věc",
      });
    } catch (error: any) {
      skipped.push({
        itemId: item.id,
        title: item.title || "Věc",
        reason: error.message || "Termín není dostupný.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    createdCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped,
  });
}
