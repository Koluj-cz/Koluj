import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { requireUser } from "@/lib/supabase/server";
import { deactivateAccountServer } from "@/lib/services/accountService";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `account:deactivate:${getClientIp(request)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  const { user } = await requireUser();


  try {
    const result = await deactivateAccountServer({
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Účet se nepodařilo deaktivovat") },
      { status: 400 }
    );
  }
}
