type OfferWithPrimaryImage = {
  id: string;
  primary_image_url: string | null;
  [key: string]: unknown;
};

type SupabaseLikeClient = {
  from: (table: string) => any;
};

const PUBLIC_IMAGE_STATUSES = [
  "approved",
  "pending",
  "processing",
  "failed",
] as const;

/**
 * Replaces an offer's stored primary_image_url with the first image that may
 * actually be displayed. This is intentionally shared by every offer-card
 * endpoint so a rejected/review image cannot leak through a different page.
 */
export async function sanitizeOfferPrimaryImages<T extends OfferWithPrimaryImage>(
  supabase: SupabaseLikeClient,
  offers: T[],
): Promise<T[]> {
  if (offers.length === 0) return offers;

  const offerIds = offers.map((offer) => offer.id);
  const { data, error } = await supabase
    .from("offer_images")
    .select("offer_id, image_url, sort_order, moderation_status")
    .in("offer_id", offerIds)
    .in("moderation_status", [...PUBLIC_IMAGE_STATUSES])
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const allowedImagesByOffer = new Map<string, string[]>();

  for (const image of data || []) {
    const current = allowedImagesByOffer.get(image.offer_id) || [];
    current.push(image.image_url);
    allowedImagesByOffer.set(image.offer_id, current);
  }

  return offers.map((offer) => {
    const allowedUrls = allowedImagesByOffer.get(offer.id) || [];
    const primaryImageUrl =
      offer.primary_image_url && allowedUrls.includes(offer.primary_image_url)
        ? offer.primary_image_url
        : allowedUrls[0] || null;

    return {
      ...offer,
      primary_image_url: primaryImageUrl,
    };
  });
}
