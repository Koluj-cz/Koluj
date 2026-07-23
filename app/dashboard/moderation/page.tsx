import { redirect } from "next/navigation";
import ModerationQueue, {
  type ModerationRow,
} from "@/app/components/admin/ModerationQueue";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  MODERATION_TABLES,
  requireModerator,
} from "@/lib/services/mediaModerationService";

export const dynamic = "force-dynamic";

export default async function DashboardModerationPage() {
  try {
    await requireModerator();
  } catch {
    redirect("/dashboard");
  }

  const supabase = createSupabaseAdminClient();
  const rows: ModerationRow[] = [];

  for (const table of MODERATION_TABLES) {
    const query = table.endsWith("videos")
      ? supabase
          .from(table)
          .select(
            "id, video_url, thumbnail_url, moderation_status, moderation_reason, created_at",
          )
      : supabase
          .from(table)
          .select(
            "id, image_url, moderation_status, moderation_reason, created_at",
          );

    const { data, error } = await query
      .in("moderation_status", ["review", "rejected", "failed"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error(`Failed to load moderation rows from ${table}:`, error);
      continue;
    }

    const items = (data ?? []) as unknown as Array<Record<string, unknown>>;

    for (const raw of items) {
      rows.push({
        id: String(raw.id),
        table,
        url:
          String(raw.thumbnail_url ?? raw.image_url ?? raw.video_url ?? "") ||
          null,
        status: String(raw.moderation_status) as ModerationRow["status"],
        reason: raw.moderation_reason ? String(raw.moderation_reason) : null,
        created_at: String(raw.created_at),
      });
    }
  }

  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return <ModerationQueue initialRows={rows} />;
}
