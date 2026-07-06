import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

const CANONICAL_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.koluj.cz";

function safeRedirectTo(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: Request) {
  const rate = checkRateLimit({
    key: `auth:otp:send:${getClientIp(request)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const redirectTo = safeRedirectTo(body?.redirectTo || null);

  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Zadej platný e-mail" }, { status: 400 });
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

  const callbackUrl = new URL("/auth/callback", CANONICAL_ORIGIN);

  if (redirectTo) {
    callbackUrl.searchParams.set("redirectTo", redirectTo);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    return NextResponse.json(
      { error: "Přihlašovací e-mail se nepodařilo odeslat" },
      { status: 400 },
    );
  }

  return response;
}
