import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const apiKey = process.env.MAPY_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Chybí MAPY_API_KEY" },
      { status: 500 }
    );
  }

  const url = `https://api.mapy.com/v1/suggest?query=${encodeURIComponent(
    query
  )}&lang=cs&limit=5`;

  const response = await fetch(url, {
    headers: {
      "X-MAPY-API-KEY": apiKey,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: "Mapy API chyba", detail: text },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json(data);
}