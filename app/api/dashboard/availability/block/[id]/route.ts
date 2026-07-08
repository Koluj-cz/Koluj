import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(request: Request, { params }: RouteProps) {
  const rate = await checkRateLimit({
    key: `dashboard-availability:block:delete:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  const { id } = await params;
  const { user } = await requireUser();


  const { data: block, error: blockError } = await supabaseAdmin
    .from("offer_availability_blocks")
    .select("id, owner_id")
    .eq("id", id)
    .single();

  if (blockError || !block) {
    return NextResponse.json(
      { error: "Blokace nebyla nalezena." },
      { status: 404 }
    );
  }

  if (block.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Tuto blokaci může zrušit pouze vlastník." },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("offer_availability_blocks")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
