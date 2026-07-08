import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rate = await checkRateLimit({
    key: `users:profile:${id}:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rate.allowed) return rateLimitResponse(rate.resetAt);

  try {
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (profileError || !profile) throw new Error("Uživatel nebyl nalezen");

    const { data: rating } = await supabaseAdmin
      .from("profile_ratings")
      .select("rating_avg, rating_count")
      .eq("profile_id", id)
      .maybeSingle();

    const { data: reviews, error: reviewsError } = await supabaseAdmin
      .from("reviews")
      .select(`
        id,
        rating,
        comment,
        created_at,
        reviewer:profiles!reviews_reviewer_id_fkey (
          full_name,
          avatar_url
        ),
        offers:offers (
          title
        )
      `)
      .eq("reviewed_user_id", id)
      .order("created_at", { ascending: false });

    if (reviewsError) throw new Error(reviewsError.message);

    const { data: offers, error: offersError } = await supabaseAdmin
      .from("offers")
      .select(`
        *,
        profiles:profiles!offers_owner_id_fkey (
          full_name,
          avatar_url,
          is_verified,
          profile_ratings (
            rating_avg,
            rating_count
          )
        )
      `)
      .eq("owner_id", id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (offersError) throw new Error(offersError.message);

    return NextResponse.json({
      profile,
      rating: rating || null,
      reviews: reviews || [],
      offers: offers || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Uživatele se nepodařilo načíst") },
      { status: 400 },
    );
  }
}
