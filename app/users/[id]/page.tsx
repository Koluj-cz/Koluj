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
  images?: Array<{ id: string; url: string; sort_order: number | null }>;
};

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [trust, setTrust] = useState<UserTrustSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(6);
  const [activePanel, setActivePanel] = useState<"offers" | "reviews">("offers");
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

            </div>
          </aside>

          <div className="min-w-0">
            <div className="koluj-card overflow-hidden">
              <div className="flex overflow-x-auto border-b border-[var(--koluj-border)] px-4 md:px-6">
                <button
                  type="button"
                  onClick={() => setActivePanel("offers")}
                  className={`relative shrink-0 px-4 py-5 font-black ${activePanel === "offers" ? "text-[var(--koluj-green)]" : "text-[var(--koluj-muted)]"}`}
                >
                  Nabídky ({items.length})
                  {activePanel === "offers" && <span className="absolute inset-x-4 bottom-0 h-1 rounded-t-full bg-[var(--koluj-green)]" />}
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel("reviews")}
                  className={`relative shrink-0 px-4 py-5 font-black ${activePanel === "reviews" ? "text-[var(--koluj-green)]" : "text-[var(--koluj-muted)]"}`}
                >
                  Recenze ({reviews.length})
                  {activePanel === "reviews" && <span className="absolute inset-x-4 bottom-0 h-1 rounded-t-full bg-[var(--koluj-green)]" />}
                </button>
              </div>

              <div className="p-5 md:p-7">
                {activePanel === "offers" ? (
                  <>
                    <div className="mb-6">
                      <h2 className="text-2xl font-black md:text-3xl">Aktuální nabídky</h2>
                      <p className="mt-2 text-sm text-[var(--koluj-muted)]">Věci a služby, které tento poskytovatel právě nabízí.</p>
                    </div>
                    {items.length > 0 && (
                      <OfferSearchFilters
                        search={offerSearch}
                        onSearchChange={setOfferSearch}
                        offerType={offerType}
                        onOfferTypeChange={(value) => { setOfferType(value); setCategory("all"); }}
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
                      <div className="rounded-2xl bg-[var(--koluj-bg)] p-6 text-[var(--koluj-muted)]">Uživatel zatím nenabízí žádné aktivní nabídky.</div>
                    ) : filteredItems.length === 0 ? (
                      <div className="mt-5 rounded-2xl bg-[var(--koluj-bg)] p-6 text-[var(--koluj-muted)]">Nic nenalezeno. Zkus změnit hledání nebo filtr.</div>
                    ) : (
                      <div className="koluj-offer-grid-wide mt-6">
                        {filteredItems.map((item) => <OfferCard key={item.id} item={item} />)}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-black md:text-3xl">Recenze uživatelů</h2>
                        <p className="mt-2 text-sm text-[var(--koluj-muted)]">Zkušenosti z dokončených rezervací s tímto poskytovatelem.</p>
                      </div>
                      {ratingCount > 0 && <div className="rounded-full bg-[var(--koluj-bg)] px-4 py-2 text-sm font-black text-[var(--koluj-green)]">★ {ratingAverage.toFixed(1)} · {ratingCount} {ratingCount === 1 ? "recenze" : "recenzí"}</div>}
                    </div>
                    {reviews.length === 0 ? (
                      <div className="rounded-2xl bg-[var(--koluj-bg)] p-6 text-[var(--koluj-muted)]">Uživatel zatím nemá žádné recenze.</div>
                    ) : (
                      <div className="grid gap-4">
                        {visibleReviews.map((review) => (
                          <article key={review.id} className="rounded-2xl border border-[var(--koluj-border)] p-5 md:p-6">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex min-w-0 items-center gap-3">
                                {review.reviewer?.avatar_url ? (
                                  <Image src={review.reviewer.avatar_url} alt={review.reviewer.full_name || "Uživatel"} width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] font-black text-[var(--koluj-green)]">{(review.reviewer?.full_name || "U").charAt(0).toUpperCase()}</div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate font-black">{review.reviewer?.full_name || "Uživatel"}</p>
                                  <p className="mt-0.5 text-xs text-[var(--koluj-muted)]">{formatDate(review.created_at)}{review.offers?.title ? ` · ${review.offers.title}` : ""}</p>
                                </div>
                              </div>
                              <div className="shrink-0 text-amber-500" aria-label={`${review.rating} z 5 hvězd`}>{"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(5 - review.rating)}</span></div>
                            </div>
                            {review.comment && <p className="mt-4 whitespace-pre-line leading-relaxed text-[var(--koluj-muted)]">{review.comment}</p>}
                            {review.images && review.images.length > 0 && (
                              <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
                                {review.images.map((image, index) => (
                                  <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className="relative aspect-square overflow-hidden rounded-xl bg-[var(--koluj-bg)]">
                                    <Image src={image.url} alt={`Fotografie k recenzi ${index + 1}`} fill unoptimized className="object-cover transition-transform hover:scale-[1.03]" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </article>
                        ))}
                        {hasMoreReviews && <button type="button" onClick={() => setVisibleReviewsCount((count) => count + 6)} className="koluj-button w-full px-6 py-3">Zobrazit další recenze</button>}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
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
