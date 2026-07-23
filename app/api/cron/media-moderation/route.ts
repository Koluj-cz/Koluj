import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/security";
import { processPendingMedia } from "@/lib/services/mediaModerationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await processPendingMedia(10));
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Moderace selhala") }, { status: 500 });
  }
}
