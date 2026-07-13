import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rateLimit";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `auth:otp:send:${getClientIp(request)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);

  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json(
      { error: "Zadej platný e-mail" },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithOtp({
    email,
  });

  if (error) {
    return NextResponse.json(
      {
        error: "Přihlašovací e-mail se nepodařilo odeslat",
      },
      { status: 400 },
    );
  }

  return response;
}