import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { errorMessage } from "@/lib/security";
import { findSearchIntent } from "@/lib/services/searchIntentService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const rate = await checkRateLimit({
    key: `search-intent:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const query = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (query.length < 3) return NextResponse.json({ intent: null });

    const intent = await findSearchIntent(createSupabaseAdminClient(), query);
    return NextResponse.json(
      { intent },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Doporučení se nepodařilo načíst"), intent: null },
      { status: 400 },
    );
  }
}
