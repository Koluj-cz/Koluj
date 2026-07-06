import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const CANONICAL_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.koluj.cz";

function safeRedirectTo(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = safeRedirectTo(requestUrl.searchParams.get("redirectTo"));

  const redirectUrl = new URL(redirectTo || "/dashboard", CANONICAL_ORIGIN);
  const errorUrl = new URL("/login", CANONICAL_ORIGIN);

  if (!code) {
    return NextResponse.redirect(errorUrl);
  }

  let response = NextResponse.redirect(redirectUrl);

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
