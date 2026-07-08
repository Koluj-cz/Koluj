import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `auth:signout:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
