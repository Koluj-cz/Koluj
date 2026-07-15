import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { requireUser } from "@/lib/supabase/server";
import { deleteAvailabilityBlockServer } from "@/lib/services/availabilityService";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const rate = await checkRateLimit({
    key: `offer-availability:block:delete:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  const { blockId } = await params;
  const { user } = await requireUser();


  try {
    const result = await deleteAvailabilityBlockServer({
      blockId,
      ownerId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Blokaci se nepodařilo zrušit") },
      { status: 400 }
    );
  }
}
