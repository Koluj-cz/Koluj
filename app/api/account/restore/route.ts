import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { requireUser } from "@/lib/supabase/server";
import { restoreAccountServer } from "@/lib/services/accountService";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `account:restore:${getClientIp(request)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  const { user } = await requireUser();


  try {
    const result = await restoreAccountServer({
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Účet se nepodařilo obnovit") },
      { status: 400 }
    );
  }
}
