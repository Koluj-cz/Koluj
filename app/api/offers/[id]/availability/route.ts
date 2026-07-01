import { NextResponse } from "next/server";
import { getOfferAvailabilityServer } from "@/lib/services/availabilityService";

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);

  return {
    dateFrom: start.toISOString().split("T")[0],
    dateTo: end.toISOString().split("T")[0],
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const defaults = monthBounds();

  const dateFrom = searchParams.get("dateFrom") || defaults.dateFrom;
  const dateTo = searchParams.get("dateTo") || defaults.dateTo;

  try {
    const availability = await getOfferAvailabilityServer({
      offerId: id,
      dateFrom,
      dateTo,
    });

    return NextResponse.json({ ok: true, ...availability });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Dostupnost se nepodařilo načíst" },
      { status: 400 }
    );
  }
}
