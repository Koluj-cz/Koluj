import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { restoreAccountServer } from "@/lib/services/accountService";

function safeRedirectTo(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit({
    key: `auth:otp:verify:${getClientIp(request)}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const token = String(body?.token || "").trim().replace(/\s+/g, "");
  const redirectTo = safeRedirectTo(body?.redirectTo || null) || "/dashboard";

  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Zadej platný e-mail" }, { status: 400 });
  }

  if (!token || token.length < 4 || token.length > 12) {
    return NextResponse.json({ error: "Zadej platný kód" }, { status: 400 });
  }

  const response = NextResponse.json({
    ok: true,
    redirectTo,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: verifyData,
    error,
  } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error || !verifyData.user) {
    return NextResponse.json(
      { error: "Kód je neplatný nebo vypršel" },
      { status: 400 },
    );
  }

  await restoreAccountServer({
    userId: verifyData.user.id,
  });

  return response;
}
