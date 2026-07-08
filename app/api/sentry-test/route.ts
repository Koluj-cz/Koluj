import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    throw new Error("Sentry server test " + new Date().toISOString());
  } catch (error) {
    Sentry.captureException(error);

    // počká, než se chyba odešle do Sentry
    await Sentry.flush(2000);

    return NextResponse.json(
      {
        ok: true,
        message: "Server test odeslán do Sentry.",
      },
      { status: 500 }
    );
  }
}