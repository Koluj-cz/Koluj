import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { deleteAvailabilityBlockServer } from "@/lib/services/availabilityService";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const { blockId } = await params;
  const { user } = await requireUser();


  try {
    const result = await deleteAvailabilityBlockServer({
      blockId,
      ownerId: user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Blokaci se nepodařilo zrušit" },
      { status: 400 }
    );
  }
}
