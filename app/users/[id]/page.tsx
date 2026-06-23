"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, ShieldCheck, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ItemCard, { type ItemCardItem } from "@/app/components/ItemCard";
import { useParams } from "next/navigation";
import AuthHeaderButton from "@/app/components/AuthHeaderButton";
import PageLoader from "@/app/components/PageLoader";

type Profile = {
  id: string;
  full_name: string | null;
  city: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean | null;
  created_at: string;
};

type Rating = {
  rating_avg: number | null;
  rating_count: number | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  items: {
    title: string | null;
  } | null;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("cs-CZ");
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [items, setItems] = useState<ItemCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      setLoading(false);
      return;
    }

    const { data: ratingData } = await supabase
      .from("profile_ratings")
      .select("rating_avg, rating_count")
      .eq("profile_id", userId)
      .maybeSingle();

    const { data: reviewsData } = await supabase
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
        items (
          title
        )
      `)
      .eq("reviewed_user_id", userId)
      .order("created_at", { ascending: false });

    const { data: itemsData } = await supabase
      .from("items")
      .select(`
        *,
        profiles:profiles!items_owner_id_fkey (
          full_name,
          avatar_url,
          is_verified,
          profile_ratings (
            rating_avg,
            rating_count
          )
        )
      `)
      .eq("owner_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setProfile(profileData as Profile);
    setRating(ratingData || null);
    setReviews((reviewsData || []) as unknown as Review[]);
    setItems((itemsData || []) as ItemCardItem[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <PageLoader />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen">
        <div className="koluj-shell">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-[var(--koluj-green)]"
          >
            <ArrowLeft size={18} />
            Zpět
          </Link>

          <div className="koluj-card mt-10 p-8">
            Uživatel nebyl nalezen.
          </div>
        </div>
      </main>
    );
  }

  const ratingText =
    rating && rating.rating_count
      ? `★ ${Number(rating.rating_avg).toFixed(1)}`
      : "★ Nový";

  const ratingCountText =
    rating && rating.rating_count ? `(${rating.rating_count})` : "";

  const initials = (profile.full_name || "Uživatel")
    .charAt(0)
    .toUpperCase();

  return (
    <main className="min-h-screen">
      <div className="koluj-shell-wide">
        <header className="koluj-page-header">
          <Link
            href="/items"
            className="flex items-center gap-2 font-bold text-[var(--koluj-green)]"
          >
            <ArrowLeft size={18} />
            Zpět na věci
          </Link>

          <AuthHeaderButton />
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-6">
            <div className="koluj-card p-8">
              <div className="flex items-center gap-5">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || "Uživatel"}
                    className="h-24 w-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-4xl font-black text-[var(--koluj-green)]">
                    {initials}
                  </div>
                )}

                <div>
                  <h1 className="text-3xl font-black">
                    {profile.full_name || "Uživatel"}
                  </h1>

                  <p className="mt-2 font-bold text-[var(--koluj-green)]">
                    {ratingText}
                    {ratingCountText && (
                      <span className="ml-1 text-[var(--koluj-muted)]">
                        {ratingCountText}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-[var(--koluj-muted)]">
                {profile.city && (
                  <p className="flex items-center gap-2">
                    <MapPin size={16} />
                    {profile.city}
                  </p>
                )}

                {profile.is_verified && (
                  <p className="inline-flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-4 py-2 font-bold text-[var(--koluj-green)]">
                    <ShieldCheck size={16} />
                    Ověřený profil
                  </p>
                )}

                <p>Na Koluj od {formatDate(profile.created_at)}</p>
              </div>

              {profile.bio && (
                <p className="mt-6 whitespace-pre-line text-[var(--koluj-muted)]">
                  {profile.bio}
                </p>
              )}
            </div>

            <div className="koluj-card p-6">
              <div className="mt-5 space-y-3 text-sm">
                <p>
                  <strong>Hodnocení:</strong>{" "}
                  {rating?.rating_count
                    ? `${Number(rating.rating_avg).toFixed(1)} / 5`
                    : "Zatím bez hodnocení"}
                </p>

                <p>
                  <strong>Počet hodnocení:</strong>{" "}
                  {rating?.rating_count || 0}
                </p>

                <p>
                  <strong>Aktivní věci:</strong> {items.length}
                </p>
              </div>
            </div>
            <section>
              {reviews.length === 0 ? (
                <div className="koluj-card p-8 text-[var(--koluj-muted)]">
                  Uživatel zatím nemá žádné recenze.
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="koluj-card p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {review.reviewer?.avatar_url ? (
                            <img
                              src={review.reviewer.avatar_url}
                              alt={review.reviewer.full_name || "Uživatel"}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--koluj-bg)] font-black text-[var(--koluj-green)]">
                              {(review.reviewer?.full_name || "Uživatel")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}

                          <div>
                            <p className="font-black">
                              {review.reviewer?.full_name || "Uživatel"}
                            </p>

                            <p className="text-sm text-[var(--koluj-muted)]">
                              {formatDate(review.created_at)}
                              {review.items?.title
                                ? ` · ${review.items.title}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <p className="font-black text-[var(--koluj-green)]">
                          {"★".repeat(review.rating)}
                          <span className="text-[var(--koluj-muted)]">
                            {"★".repeat(5 - review.rating)}
                          </span>
                        </p>
                      </div>

                      {review.comment && (
                        <p className="mt-4 whitespace-pre-line text-[var(--koluj-muted)]">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>

          <div className="space-y-10">
            <section>

              {items.length === 0 ? (
                <div className="koluj-card p-8 text-[var(--koluj-muted)]">
                  Uživatel zatím nenabízí žádné aktivní věci.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}