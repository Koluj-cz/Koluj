import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { createAvailabilityBlockServer } from "@/lib/services/availabilityService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user } = await requireUser();


  const { dateFrom, dateTo, startsAt, endsAt, reason } = await request.json();

  if ((!dateFrom || !dateTo) && (!startsAt || !endsAt)) {
    return NextResponse.json(
      { error: "Vyber termín blokace." },
      { status: 400 }
    );
  }

  try {
    const block = await createAvailabilityBlockServer({
      offerId: id,
      ownerId: user.id,
      dateFrom,
      dateTo,
      startsAt,
      endsAt,
      reason,
    });

    return NextResponse.json({ ok: true, block });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Blokaci se nepodařilo vytvořit" },
      { status: 400 }
    );
  }
}
