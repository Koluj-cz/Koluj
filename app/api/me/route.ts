import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";

const profileSelect = "id, email, full_name, city, latitude, longitude, is_deactivated, deactivated_at";

export async function GET() {
  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    let { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select(profileSelect)
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      const inserted = await supabaseAdmin
        .from("profiles")
        .insert({ id: user.id, email: user.email })
        .select(profileSelect)
        .single();

      profile = inserted.data;
      error = inserted.error;
    }

    if (error || !profile) {
      throw new Error(error?.message || "Profil se nepodařilo načíst");
    }

    const profileComplete = Boolean(
      profile.full_name && profile.city && profile.latitude && profile.longitude,
    );

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email || profile.email || null,
      },
      profile: {
        ...profile,
        email: profile.email || user.email || "",
      },
      profileComplete,
    });
  } catch (error) {
    const message = errorMessage(error, "Uživatel se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json(
      { authenticated: false, error: message, profileComplete: false },
      { status },
    );
  }
}
