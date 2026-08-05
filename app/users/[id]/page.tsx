"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CalendarDays, MapPin, Package, Star, Trophy } from "lucide-react";
import BackLink from "@/app/components/BackLink";
import OfferCard, { type OfferCardOffer } from "@/app/components/OfferCard";
import { useParams } from "next/navigation";
import PageLoader from "@/app/components/PageLoader";
import OfferSearchFilters from "@/app/components/OfferSearchFilters";
import { formatDate } from "@/lib/format";
import { matchesSearchQuery } from "@/lib/services/searchService";
import UserTrustCard from "@/app/components/user/UserTrustCard";
import UserTrustBadge from "@/app/components/user/UserTrustBadge";
import type { UserTrustSummary } from "@/lib/services/userTrustService";
import {
  getOfferCategoryFilterOptions,
  offerFilterSortOptions,
  offerFilterTypeOptions,
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
  const [trust, setTrust] = useState<UserTrustSummary | null>(null);
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
      result = result.filter((item) => matchesSearchQuery(item, offerSearch));
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
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    if (sortBy === "oldest") {
      result.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
    setTrust(result.trust || null);
    setReviews((result.reviews || []) as Review[]);
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

          <div className="koluj-card mt-10 p-8">Uživatel nebyl nalezen.</div>
        </div>
      </main>
    );
  }

  const ratingAverage = Number(rating?.rating_avg || 0);
  const ratingCount = Number(rating?.rating_count || 0);
  const initials = (profile.full_name || "Uživatel").charAt(0).toUpperCase();
  const visibleReviews = reviews.slice(0, visibleReviewsCount);
  const hasMoreReviews = visibleReviewsCount < reviews.length;

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <div className="mb-6 hidden md:block">
          <BackLink href="/">Domů</BackLink>
        </div>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="min-w-0">
            <div className="koluj-card overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex min-w-0 items-center gap-5">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={profile.full_name || "Uživatel"}
                      width={104}
                      height={104}
                      className="h-24 w-24 shrink-0 rounded-full object-cover md:h-26 md:w-26"
                    />
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-4xl font-black text-[var(--koluj-green)] md:h-26 md:w-26">
                      {initials}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="min-w-0 break-words text-3xl font-black">
                        {profile.full_name || "Uživatel"}
                      </h1>
                      {trust && <UserTrustBadge level={trust.level} compact />}
                    </div>

                  </div>
                </div>

                <div className="mt-6 grid gap-3 text-sm text-[var(--koluj-muted)]">
                  {profile.city && (
                    <p className="flex items-start gap-2">
                      <MapPin size={17} className="mt-0.5 shrink-0" />
                      <span>{profile.city}</span>
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <CalendarDays size={17} className="shrink-0" />
                    Na Koluj od {formatDate(profile.created_at)}
                  </p>
                </div>

                {profile.bio && (
                  <p className="mt-6 whitespace-pre-line leading-relaxed text-[var(--koluj-muted)]">
                    {profile.bio}
                  </p>
                )}

                <div className="mt-7 grid grid-cols-3 gap-2">
                  <ProfileStat
                    icon={<Star size={18} />}
                    value={ratingCount ? ratingAverage.toFixed(1) : "–"}
                    label={ratingCount === 1 ? "1 recenze" : `${ratingCount} recenzí`}
                  />
                  <ProfileStat
                    icon={<Trophy size={18} />}
                    value={String(trust?.completedBookings || 0)}
                    label="Dokončeno"
                  />
                  <ProfileStat
                    icon={<Package size={18} />}
                    value={String(items.length)}
                    label="Aktivní nabídky"
                  />
                </div>
              </div>

              {trust && (
                <div className="border-t border-[var(--koluj-border)] p-6 md:p-8">
                  <UserTrustCard trust={trust} embedded compactDetails />
                </div>
              )}

              <div className="border-t border-[var(--koluj-border)] p-6 md:p-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">Hodnocení</h2>
                    <p className="mt-1 text-sm text-[var(--koluj-muted)]">
                      Zkušenosti ostatních uživatelů s tímto poskytovatelem.
                    </p>
                  </div>
                </div>

                {reviews.length === 0 ? (
                  <p className="mt-5 rounded-2xl bg-[var(--koluj-bg)] p-4 text-sm text-[var(--koluj-muted)]">
                    Uživatel zatím nemá žádné recenze.
                  </p>
                ) : (
                  <div className="mt-5 space-y-4">
                    {visibleReviews.map((review) => (
                      <article
                        key={review.id}
                        className="rounded-2xl border border-[var(--koluj-border)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {review.reviewer?.avatar_url ? (
                              <Image
                                src={review.reviewer.avatar_url}
                                alt={review.reviewer.full_name || "Uživatel"}
                                width={40}
                                height={40}
                                className="h-10 w-10 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] font-black text-[var(--koluj-green)]">
                                {(review.reviewer?.full_name || "Uživatel")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="truncate font-black">
                                {review.reviewer?.full_name || "Uživatel"}
                              </p>
                              <p className="mt-0.5 text-xs text-[var(--koluj-muted)]">
                                {formatDate(review.created_at)}
                                {review.offers?.title
                                  ? ` · ${review.offers.title}`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          <p className="shrink-0 text-sm font-black text-[var(--koluj-green)]">
                            {review.rating}/5
                          </p>
                        </div>

                        {review.comment && (
                          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--koluj-muted)]">
                            {review.comment}
                          </p>
                        )}
                      </article>
                    ))}

                    {hasMoreReviews && (
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleReviewsCount((count) => count + 5)
                        }
                        className="koluj-button w-full px-6 py-3"
                      >
                        Zobrazit další recenze
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--koluj-green)]">
                Nabídky poskytovatele
              </p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-3xl font-black md:text-4xl">
                    Co nabízí {profile.full_name || "uživatel"}
                  </h2>
                  <p className="mt-2 text-[var(--koluj-muted)]">
                    Prohlédněte si aktuální věci a služby tohoto poskytovatele.
                  </p>
                </div>
                <span className="rounded-full bg-[var(--koluj-bg)] px-4 py-2 text-sm font-black">
                  {items.length} {items.length === 1 ? "nabídka" : "nabídek"}
                </span>
              </div>
            </div>

            {items.length > 0 && (
              <OfferSearchFilters
                search={offerSearch}
                onSearchChange={setOfferSearch}
                offerType={offerType}
                onOfferTypeChange={(value) => {
                  setOfferType(value);
                  setCategory("all");
                }}
                offerTypeOptions={offerFilterTypeOptions}
                category={category}
                onCategoryChange={setCategory}
                categoryOptions={getOfferCategoryFilterOptions(offerType)}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                sortOptions={offerFilterSortOptions}
              />
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
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfileStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-[var(--koluj-bg)] p-3 text-center">
      <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--koluj-green)]">
        {icon}
      </span>
      <p className="mt-2 truncate text-lg font-black">{value}</p>
      <p className="mt-0.5 truncate text-xs font-bold text-[var(--koluj-muted)]">
        {label}
      </p>
    </div>
  );
}
