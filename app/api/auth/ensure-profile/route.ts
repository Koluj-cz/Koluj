import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = await checkRateLimit({
    key: `auth:ensure-profile:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email,
        },
        { onConflict: "id" },
      )
      .select("full_name, city, latitude, longitude")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      profileComplete: Boolean(
        profile?.full_name && profile?.city && profile?.latitude && profile?.longitude,
      ),
    });
  } catch (error) {
    const message = errorMessage(error, "Profil se nepodařilo připravit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message, profileComplete: false }, { status });
  }
}
