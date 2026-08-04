import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/security";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { sanitizeOfferPrimaryImages } from "@/lib/services/offerPrimaryImageService";
import { calculateUserTrust } from "@/lib/services/userTrustService";

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
      .select("id, full_name, avatar_url, bio, city, phone, is_verified, created_at, is_seed_user, is_deactivated")
      .eq("id", id)
      .maybeSingle();

    if (profileError || !profile || profile.is_deactivated) {
      throw new Error("Uživatel nebyl nalezen");
    }

    const { data: rating } = await supabaseAdmin
      .from("profile_ratings")
      .select("rating_avg, rating_count")
      .eq("profile_id", id)
      .maybeSingle();

    const [{ data: authUserData }, { count: completedBookings }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(id),
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", id)
        .eq("status", "returned"),
    ]);

    const authUser = authUserData.user;
    const banned = Boolean(
      authUser?.banned_until && new Date(authUser.banned_until).getTime() > Date.now(),
    );
    const trust = calculateUserTrust({
      emailVerified: Boolean(authUser?.email_confirmed_at),
      phoneProvided: Boolean(profile.phone?.trim()),
      completedBookings: completedBookings || 0,
      ratingAverage: Number(rating?.rating_avg || 0),
      ratingCount: Number(rating?.rating_count || 0),
      joinedAt: profile.created_at,
      banned,
    });

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
      .eq("publication_status", "active")
      .eq("hidden_by_account_deactivation", false)
      .order("created_at", { ascending: false });

    if (offersError) throw new Error(offersError.message);

    const offersWithSafeImages = await sanitizeOfferPrimaryImages(
      supabaseAdmin,
      offers || [],
    );

    const publicProfile = {
      id: profile.id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      city: profile.city,
      is_verified: profile.is_verified,
      created_at: profile.created_at,
    };

    return NextResponse.json({
      profile: publicProfile,
      trust,
      rating: rating || null,
      reviews: reviews || [],
      offers: offersWithSafeImages,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Uživatele se nepodařilo načíst") },
      { status: 400 },
    );
  }
}
