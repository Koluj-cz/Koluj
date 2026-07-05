import { NextResponse } from "next/server";
import { createSupabaseAdminClient, requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

type ProfilePayload = {
  full_name?: string;
  city?: string;
  phone?: string;
  bio?: string;
  latitude?: number | null;
  longitude?: number | null;
  email_notifications_enabled?: boolean;
  marketing_notifications_enabled?: boolean;
};

function normalizeProfilePayload(payload: ProfilePayload) {
  const fullName = String(payload.full_name || "").trim();
  const city = String(payload.city || "").trim();
  const phone = String(payload.phone || "").trim();
  const bio = String(payload.bio || "").trim();

  if (!fullName || fullName.length > 120) {
    throw new Error("Vyplň své jméno do 120 znaků");
  }

  if (!city || city.length > 160) {
    throw new Error("Vyplň město nebo oblast");
  }

  if (phone.length > 40) {
    throw new Error("Telefon je příliš dlouhý");
  }

  if (bio.length > 1000) {
    throw new Error("Text o mně je příliš dlouhý");
  }

  const latitude =
    typeof payload.latitude === "number" && Number.isFinite(payload.latitude)
      ? payload.latitude
      : null;

  const longitude =
    typeof payload.longitude === "number" && Number.isFinite(payload.longitude)
      ? payload.longitude
      : null;

  if (latitude === null || longitude === null) {
    throw new Error("Vyber místo z našeptávače");
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Vybraná poloha není platná");
  }

  return {
    full_name: fullName,
    city,
    phone: phone || null,
    bio: bio || null,
    latitude,
    longitude,
    email_notifications_enabled:
      payload.email_notifications_enabled !== false,
    marketing_notifications_enabled:
      payload.marketing_notifications_enabled === true,
  };
}

const profileSelect =
  "id, email, full_name, city, phone, bio, latitude, longitude, email_notifications_enabled, marketing_notifications_enabled, push_notifications_enabled";

export async function GET() {
  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();

    let { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select(profileSelect)
      .eq("id", user.id)
      .single();

    if (!profile) {
      const insert = await supabaseAdmin
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
        })
        .select(profileSelect)
        .single();

      profile = insert.data;
      error = insert.error;
    }

    if (error || !profile) {
      throw new Error(error?.message || "Profil se nepodařilo načíst");
    }

    return NextResponse.json({
      profile: {
        ...profile,
        email: profile.email || user.email || "",
      },
    });
  } catch (error) {
    const message = errorMessage(error, "Profil se nepodařilo načíst");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  const rate = checkRateLimit({
    key: `profile:update:${getClientIp(request)}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return rateLimitResponse(rate.resetAt);
  }

  try {
    const { user } = await requireUser();
    const supabaseAdmin = createSupabaseAdminClient();
    const payload = (await request.json()) as ProfilePayload;
    const update = normalizeProfilePayload(payload);

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(update)
      .eq("id", user.id)
      .select(profileSelect)
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Profil se nepodařilo uložit");
    }

    return NextResponse.json({
      ok: true,
      profile: {
        ...data,
        email: data.email || user.email || "",
      },
    });
  } catch (error) {
    const message = errorMessage(error, "Profil se nepodařilo uložit");
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
