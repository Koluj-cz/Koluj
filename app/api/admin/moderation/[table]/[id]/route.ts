import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { requireModerator, setMediaModerationStatus } from "@/lib/services/mediaModerationService";

export async function PATCH(request: Request, { params }: { params: Promise<{ table: string; id: string }> }) {
  try {
    await requireModerator();
    const { table, id } = await params;
    const body = await request.json();
    const status = body?.status === "approved" ? "approved" : body?.status === "rejected" ? "rejected" : null;
    if (!status) throw new Error("Neplatný stav");
    return NextResponse.json(await setMediaModerationStatus(table, id, status));
  } catch (error) {
    const message = errorMessage(error, "Stav se nepodařilo změnit");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
