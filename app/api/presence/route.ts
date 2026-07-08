import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `presence:update:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Aktivitu se nepodařilo uložit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
