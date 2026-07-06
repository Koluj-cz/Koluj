import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  assertOfferAvailableServer,
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
  offerIds?: string[];
};

export async function POST(request: Request) {
  const { user } = await requireUser();


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
  const offerIds = Array.isArray(body.offerIds)
    ? body.offerIds.filter(Boolean)
    : [];

  if (!applyToAll && offerIds.length === 0) {
    return NextResponse.json(
      { error: "Vyber alespoň jednu nabídku." },
      { status: 400 }
    );
  }

  let query = supabaseAdmin
    .from("offers")
    .select("id, title")
    .eq("owner_id", user.id)
    .is("deleted_at", null);

  if (!applyToAll) {
    query = query.in("id", offerIds);
  }

  const { data: offers, error: offersError } = await query.order("created_at", {
    ascending: false,
  });

  if (offersError) {
    return NextResponse.json({ error: offersError.message }, { status: 400 });
  }

  if (!offers || offers.length === 0) {
    return NextResponse.json(
      { error: "Nenalezeny žádné nabídky k blokaci." },
      { status: 400 }
    );
  }

  const created: { id: string; offerId: string; title: string }[] = [];
  const skipped: { offerId: string; title: string; reason: string }[] = [];

  for (const offer of offers) {
    try {
      await assertOfferAvailableServer({
        offerId: offer.id,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      });

      const { data: block, error: blockError } = await supabaseAdmin
        .from("offer_availability_blocks")
        .insert({
          offer_id: offer.id,
          owner_id: user.id,
          date_from: range.dateFrom,
          date_to: range.dateTo,
          reason: body.reason?.trim() || null,
        })
        .select("id")
        .single();

      if (blockError || !block) {
        skipped.push({
          offerId: offer.id,
          title: offer.title || "Nabídka",
          reason: blockError?.message || "Blokaci se nepodařilo vytvořit.",
        });
        continue;
      }

      created.push({
        id: block.id,
        offerId: offer.id,
        title: offer.title || "Nabídka",
      });
    } catch (error: any) {
      skipped.push({
        offerId: offer.id,
        title: offer.title || "Nabídka",
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
