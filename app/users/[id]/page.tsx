"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, ShieldCheck, Star } from "lucide-react";
import BackLink from "@/app/components/BackLink";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import { useParams } from "next/navigation";
import AuthHeaderButton from "@/app/components/AuthHeaderButton";
import PageLoader from "@/app/components/PageLoader";
import OfferSearchFilters from "@/app/components/OfferSearchFilters";
import { formatDate } from "@/lib/format";
import {
  categories,
  categoryLabels,
  serviceCategories,
  serviceCategoryLabels,
  offerTypeLabels,
} from "@/lib/constants";


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

function getCategoryOptions(offerType: string) {
  if (offerType === "service") {
    return {
      all: "Všechny kategorie",
      ...Object.fromEntries(serviceCategories.map((c) => [c, serviceCategoryLabels[c]])),
    };
  }

  if (offerType === "item") {
    return {
      all: "Všechny kategorie",
      ...Object.fromEntries(categories.map((c) => [c, categoryLabels[c]])),
    };
  }

  return {
    all: "Všechny kategorie",
    ...Object.fromEntries(categories.map((c) => [c, categoryLabels[c]])),
    ...Object.fromEntries(serviceCategories.map((c) => [c, serviceCategoryLabels[c]])),
  };
}

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  offers: {
    title: string | null;
  } | null;
};

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(5);
  const [items, setItems] = useState<OfferCardOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [offerSearch, setOfferSearch] = useState("");
  const [offerType, setOfferType] = useState("all");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (offerSearch.trim()) {
      const query = offerSearch.toLowerCase();

      result = result.filter((item) =>
        `${item.title} ${item.category} ${item.pickup_place} ${item.description || ""}`
          .toLowerCase()
          .includes(query)
      );
    }

    if (offerType !== "all") {
      result = result.filter((item) => (item.offer_type || "item") === offerType);
    }

    if (category !== "all") {
      result = result.filter((item) => item.category === category);
    }

    if (sortBy === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    if (sortBy === "oldest") {
      result.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    if (sortBy === "az") {
      result.sort((a, b) => a.title.localeCompare(b.title, "cs"));
    }

    if (sortBy === "za") {
      result.sort((a, b) => b.title.localeCompare(a.title, "cs"));
    }

    return result;
  }, [items, offerSearch, offerType, category, sortBy]);

  const loadProfile = useCallback(async () => {
    const response = await fetch(`/api/users/${userId}`, {
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.profile) {
      setLoading(false);
      return;
    }

    setProfile(result.profile as Profile);
    setRating(result.rating || null);
    setReviews((result.reviews || []) as unknown as Review[]);
    setItems((result.offers || []) as OfferCardOffer[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);


  if (loading) {
    return (
      <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
        <PageLoader />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
        <div className="koluj-wide-frame relative z-10">
          <BackLink href="/">Zpět</BackLink>

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

  const visibleReviews = reviews.slice(0, visibleReviewsCount);
  const hasMoreReviews = visibleReviewsCount < reviews.length;

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8 xl:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackLink href="/">Domů</BackLink>
            <AuthHeaderButton />
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
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
                  <strong>Aktivní nabídky:</strong> {items.length}
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
                  {visibleReviews.map((review) => (
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
                              {review.offers?.title
                                ? ` · ${review.offers.title}`
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
                    {hasMoreReviews && (
                      <button
                        type="button"
                        onClick={() => setVisibleReviewsCount((count) => count + 5)}
                        className="koluj-button w-full px-6 py-3"
                      >
                        Zobrazit další recenze
                      </button>
                    )}
                </div>
              )}
            </section>
          </aside>

          <div className="space-y-10">
            <section>
              {items.length > 0 && (
                <div className="mb-6">
                  <OfferSearchFilters
                    search={offerSearch}
                    onSearchChange={setOfferSearch}
                    offerType={offerType}
                    onOfferTypeChange={(value) => {
                      setOfferType(value);
                      setCategory("all");
                    }}
                    offerTypeOptions={[
                      { value: "all", label: "Vše" },
                      ...Object.entries(offerTypeLabels).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                    category={category}
                    onCategoryChange={setCategory}
                    categoryOptions={Object.entries(getCategoryOptions(offerType)).map(
                      ([value, label]) => ({ value, label })
                    )}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    sortOptions={[
                      { value: "newest", label: "Nejnovější" },
                      { value: "oldest", label: "Nejstarší" },
                      { value: "az", label: "Název A–Z" },
                      { value: "za", label: "Název Z–A" },
                    ]}
                  />
                </div>
              )}

              {items.length === 0 ? (
                <div className="koluj-card p-8 text-[var(--koluj-muted)]">
                  Uživatel zatím nenabízí žádné aktivní nabídky.
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="koluj-card p-8 text-[var(--koluj-muted)]">
                  Nic nenalezeno. Zkus změnit hledání nebo filtr.
                </div>
              ) : (
                <div className="koluj-offer-grid-wide">
                  {filteredItems.map((item) => (
                    <OfferCard key={item.id} item={item} />
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