import { redirect } from "next/navigation";
import ModerationQueue, { type ModerationRow } from "@/app/components/admin/ModerationQueue";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { MODERATION_TABLES, requireModerator } from "@/lib/services/mediaModerationService";

export const dynamic = "force-dynamic";

type RawMedia = Record<string, unknown>;

type OfferInfo = {
  id: string;
  owner_id: string;
  title: string | null;
};

type ProfileInfo = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default async function DashboardModerationPage() {
  try {
    await requireModerator();
  } catch {
    redirect("/dashboard");
  }

  const supabase = createSupabaseAdminClient();
  const media: Array<{ table: string; raw: RawMedia }> = [];

  for (const table of MODERATION_TABLES) {
    const select = table === "offer_videos"
      ? "id, offer_id, video_url, thumbnail_url, moderation_status, moderation_reason, created_at"
      : table === "offer_images"
        ? "id, offer_id, image_url, moderation_status, moderation_reason, created_at"
        : table === "service_realization_videos"
          ? "id, realization_id, video_url, thumbnail_url, moderation_status, moderation_reason, created_at"
          : "id, realization_id, image_url, moderation_status, moderation_reason, created_at";

    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in("moderation_status", ["review", "rejected", "failed"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error(`Failed to load moderation rows from ${table}:`, error);
      continue;
    }

    for (const raw of (data ?? []) as unknown as RawMedia[]) media.push({ table, raw });
  }

  const realizationIds = Array.from(new Set(media.map(({ raw }) => String(raw.realization_id || "")).filter(Boolean)));
  const realizationToOffer = new Map<string, string>();
  if (realizationIds.length) {
    const { data } = await supabase.from("service_realizations").select("id, offer_id").in("id", realizationIds);
    for (const item of (data ?? []) as Array<{ id: string; offer_id: string }>) realizationToOffer.set(item.id, item.offer_id);
  }

  const offerIds = Array.from(new Set(media.map(({ raw }) => {
    const direct = String(raw.offer_id || "");
    return direct || realizationToOffer.get(String(raw.realization_id || "")) || "";
  }).filter(Boolean)));

  const offers = new Map<string, OfferInfo>();
  if (offerIds.length) {
    const { data } = await supabase.from("offers").select("id, owner_id, title").in("id", offerIds);
    for (const item of (data ?? []) as OfferInfo[]) offers.set(item.id, item);
  }

  const ownerIds = Array.from(new Set(Array.from(offers.values()).map((offer) => offer.owner_id).filter(Boolean)));
  const profiles = new Map<string, ProfileInfo>();
  if (ownerIds.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds);
    for (const item of (data ?? []) as ProfileInfo[]) profiles.set(item.id, item);
  }

  const rows: ModerationRow[] = media.map(({ table, raw }) => {
    const offerId = String(raw.offer_id || "") || realizationToOffer.get(String(raw.realization_id || "")) || null;
    const offer = offerId ? offers.get(offerId) : undefined;
    const profile = offer?.owner_id ? profiles.get(offer.owner_id) : undefined;
    return {
      id: String(raw.id),
      table,
      url: String(raw.thumbnail_url ?? raw.image_url ?? raw.video_url ?? "") || null,
      videoUrl: table.endsWith("videos") ? String(raw.video_url || "") || null : null,
      status: String(raw.moderation_status) as ModerationRow["status"],
      reason: raw.moderation_reason ? String(raw.moderation_reason) : null,
      created_at: String(raw.created_at),
      offerId,
      offerTitle: offer?.title || null,
      userId: offer?.owner_id || null,
      userName: profile?.full_name || null,
      userEmail: profile?.email || null,
    };
  });

  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return <ModerationQueue initialRows={rows} />;
}
