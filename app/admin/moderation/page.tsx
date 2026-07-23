import { redirect } from "next/navigation";
import ModerationActions from "@/app/components/admin/ModerationActions";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  MODERATION_TABLES,
  requireModerator,
} from "@/lib/services/mediaModerationService";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  table: string;
  url: string | null;
  status: string;
  reason: string | null;
  created_at: string;
};

export default async function ModerationPage() {
  try {
    await requireModerator();
  } catch {
    redirect("/login");
  }

  const supabase = createSupabaseAdminClient();
  const rows: Row[] = [];

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
      .limit(50);

    if (error) {
      console.error(`Failed to load moderation rows from ${table}:`, error);
      continue;
    }

    const items = (data ?? []) as unknown as Array<
      Record<string, unknown>
    >;

    for (const raw of items) {
      rows.push({
        id: String(raw.id),
        table,
        url:
          String(
            raw.thumbnail_url ??
              raw.image_url ??
              raw.video_url ??
              "",
          ) || null,
        status: String(raw.moderation_status),
        reason: raw.moderation_reason
          ? String(raw.moderation_reason)
          : null,
        created_at: String(raw.created_at),
      });
    }
  }

  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-black">Moderace obsahu</h1>

      <p className="mt-2 text-[var(--koluj-muted)]">
        Podezřelá a automaticky zamítnutá média. Nová videa se veřejně
        zobrazí až po schválení.
      </p>

      <div className="mt-8 grid gap-4">
        {rows.length === 0 && (
          <div className="koluj-card p-6 font-bold">
            Fronta je prázdná.
          </div>
        )}

        {rows.map((row) => (
          <article
            key={`${row.table}-${row.id}`}
            className="koluj-card flex flex-col gap-4 p-4 md:flex-row md:items-center"
          >
            {row.url ? (
              <img
                src={row.url}
                alt="Náhled média"
                className="h-32 w-full rounded-2xl object-cover md:w-52"
              />
            ) : (
              <div className="h-32 w-full rounded-2xl bg-gray-100 md:w-52" />
            )}

            <div className="min-w-0 flex-1">
              <p className="font-black">{row.table}</p>
              <p className="mt-1 text-sm font-bold">
                Stav: {row.status}
              </p>
              <p className="mt-1 text-sm text-[var(--koluj-muted)]">
                {row.reason || "Bez uvedeného důvodu"}
              </p>
              <p className="mt-1 text-xs text-[var(--koluj-muted)]">
                {new Date(row.created_at).toLocaleString("cs-CZ")}
              </p>
            </div>

            <ModerationActions table={row.table} id={row.id} />
          </article>
        ))}
      </div>
    </main>
  );
}