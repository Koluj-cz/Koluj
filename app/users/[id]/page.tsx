import { notFound } from "next/navigation";
import UserProfileClient, {
  type PublicProfile,
  type PublicRating,
  type PublicReview,
} from "@/app/users/[id]/UserProfileClient";
import type { OfferCardOffer } from "@/app/components/OfferCard";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadPublicProfile(id: string) {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_url, bio, city, is_verified, created_at, is_seed_user")
    .eq("id", id)
    .maybeSingle();

  if (profileError || !profile) return null;

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
      id,
      owner_id,
      title,
      description,
      offer_type,
      category,
      condition,
      pickup_place,
      pickup_latitude,
      pickup_longitude,
      price_amount,
      price_unit,
      primary_image_url,
      created_at,
      status,
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

  return {
    profile: profile as PublicProfile,
    rating: (rating || null) as PublicRating | null,
    reviews: (reviews || []) as unknown as PublicReview[],
    offers: (offers || []) as unknown as OfferCardOffer[],
  };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadPublicProfile(id);

  if (!result) notFound();

  return (
    <UserProfileClient
      initialProfile={result.profile}
      initialRating={result.rating}
      initialReviews={result.reviews}
      initialOffers={result.offers}
    />
  );
}
