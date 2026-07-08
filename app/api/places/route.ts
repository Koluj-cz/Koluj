import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function GET(request: Request) {
  const rate = await checkRateLimit({
    key: `places:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  if (query.length > 120) {
    return NextResponse.json({ error: "Dotaz je příliš dlouhý" }, { status: 400 });
  }

  const apiKey = process.env.MAPY_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Chybí MAPY_API_KEY" }, { status: 500 });
  }

  const url = `https://api.mapy.com/v1/suggest?query=${encodeURIComponent(query)}&lang=cs&limit=5`;

  const response = await fetch(url, {
    headers: {
      "X-MAPY-API-KEY": apiKey,
    },
    next: {
      revalidate: 60 * 60,
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Mapy API chyba" }, { status: response.status });
  }

  const data = await response.json();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
