import { notFound } from "next/navigation";
import OfferDetailClient, {
  type AvailabilityBlock,
  type ItemDetail,
  type ItemImage,
} from "@/app/offers/[id]/OfferDetailClient";
import { createRequestSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getCurrentUserId() {
  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || null;
}

async function loadOfferDetail(id: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const currentUserId = await getCurrentUserId();

  const { data, error } = await supabaseAdmin
    .from("offers")
    .select(
      `
      id,
      owner_id,
      title,
      description,
      category,
      pickup_place,
      deposit,
      status,
      is_active,
      views_count,
      contact_note,
      created_at,
      pickup_latitude,
      pickup_longitude,
      handover_options,
      condition,
      primary_image_url,
      price_amount,
      price_unit,
      price_note,
      is_seed_item,
      deleted_at,
      offer_type,
      service_duration_minutes,
      service_location_type,
      profiles:profiles!offers_owner_id_fkey (
        full_name,
        avatar_url,
        is_verified,
        is_seed_user,
        profile_ratings (
          rating_avg,
          rating_count
        )
      )
    `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;

  if (data.is_active !== true && data.owner_id !== currentUserId) {
    return null;
  }

  await supabaseAdmin.rpc("increment_offer_views", {
    offer_id_input: id,
  });

  const { data: imageData, error: imageError } = await supabaseAdmin
    .from("offer_images")
    .select("id, image_url, sort_order")
    .eq("offer_id", id)
    .order("sort_order", { ascending: true });

  if (imageError) throw new Error(imageError.message);

  const today = new Date().toISOString().split("T")[0];

  const { data: blocksData, error: blocksError } = await supabaseAdmin
    .from("offer_availability_blocks")
    .select("id, date_from, date_to, reason")
    .eq("offer_id", id)
    .gte("date_to", today)
    .order("date_from", { ascending: true });

  if (blocksError) throw new Error(blocksError.message);

  return {
    item: {
      ...data,
      views_count: Number(data.views_count || 0) + 1,
    } as unknown as ItemDetail,
    images: (imageData || []) as unknown as ItemImage[],
    availabilityBlocks: (blocksData || []) as unknown as AvailabilityBlock[],
    currentUserId,
  };
}

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadOfferDetail(id);

  if (!result) notFound();

  return (
    <OfferDetailClient
      initialItem={result.item}
      initialImages={result.images}
      initialAvailabilityBlocks={result.availabilityBlocks}
      currentUserId={result.currentUserId}
    />
  );
}
