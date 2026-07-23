import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const MODERATION_TABLES = [
  "offer_images",
  "offer_videos",
  "service_realization_images",
  "service_realization_videos",
] as const;

export type ModerationTable = (typeof MODERATION_TABLES)[number];
type ModerationStatus = "pending" | "processing" | "approved" | "review" | "rejected" | "failed";

type MediaRow = {
  id: string;
  image_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  moderation_status: ModerationStatus;
};

type OpenAIModerationResult = {
  flagged?: boolean;
  categories?: Record<string, boolean>;
  category_scores?: Record<string, number>;
};

function isModerationTable(value: string): value is ModerationTable {
  return (MODERATION_TABLES as readonly string[]).includes(value);
}

function mediaUrl(table: ModerationTable, row: MediaRow) {
  return table.endsWith("videos") ? row.thumbnail_url : row.image_url;
}

function classify(result: OpenAIModerationResult): { status: ModerationStatus; reason: string | null } {
  const scores = result.category_scores || {};
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const active = Object.entries(result.categories || {}).filter(([, active]) => active).map(([name]) => name);
  const score = (category: string) => Number(scores[category] || 0);

  if (result.flagged) {
    return {
      status: "rejected",
      reason: active.length ? `Automaticky označeno: ${active.join(", ")}` : "Automaticky označeno jako nevhodný obsah",
    };
  }

  // Moderation API can return flagged=false even for borderline images. Koluj uses
  // stricter application thresholds so suspicious sexual/graphic content always
  // reaches a human instead of being silently approved.
  if (score("sexual/minors") >= 0.01 || score("sexual") >= 0.25 || score("violence/graphic") >= 0.2) {
    const category = score("sexual/minors") >= 0.01
      ? "sexual/minors"
      : score("sexual") >= 0.25
        ? "sexual"
        : "violence/graphic";
    return {
      status: "rejected",
      reason: `Překročen bezpečnostní limit: ${category} (${Math.round(score(category) * 100)} %)` ,
    };
  }

  if (score("sexual") >= 0.08 || score("violence") >= 0.15 || score("self-harm") >= 0.1 || (top && top[1] >= 0.2)) {
    const category = top?.[0] || "obsah";
    const value = top?.[1] || 0;
    return { status: "review", reason: `Nejistý výsledek: ${category} (${Math.round(value * 100)} %)` };
  }

  return { status: "approved", reason: null };
}

async function moderateImageUrl(url: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Chybí OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: [{ type: "image_url", image_url: { url } }],
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Moderation API ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { results?: OpenAIModerationResult[] };
  const result = payload.results?.[0];
  if (!result) throw new Error("Moderation API nevrátilo výsledek");
  return { result, ...classify(result) };
}

async function notifyAdmin(rows: Array<{ table: ModerationTable; id: string; status: string; reason: string | null }>) {
  const noteworthy = rows.filter((row) => row.status === "review" || row.status === "rejected" || row.status === "failed");
  if (!noteworthy.length || !process.env.RESEND_API_KEY) return;

  const recipient = process.env.MODERATION_RECIPIENT || "info@koluj.cz";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://koluj.cz";
  const resend = new Resend(process.env.RESEND_API_KEY);
  const list = noteworthy.map((row) => `<li><strong>${row.status}</strong> · ${row.table} · ${row.reason || "bez důvodu"}</li>`).join("");

  await resend.emails.send({
    from: process.env.MODERATION_FROM || "Koluj <noreply@koluj.cz>",
    to: recipient,
    subject: `Koluj.cz: ${noteworthy.length} médií vyžaduje pozornost`,
    html: `<h2>Moderace obsahu</h2><ul>${list}</ul><p><a href="${baseUrl}/dashboard/moderation">Otevřít frontu moderace</a></p>`,
  });
}


async function processMedia(tableValue: string, id: string, suppliedFrameUrls: string[] = []) {
  if (!isModerationTable(tableValue)) throw new Error("Neplatný typ média");

  const supabase = createSupabaseAdminClient();
  const select = tableValue.endsWith("videos")
    ? "id, video_url, thumbnail_url, moderation_status"
    : "id, image_url, moderation_status";
  const { data, error } = await supabase
    .from(tableValue)
    .select(select)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`${tableValue}: ${error.message}`);
  if (!data) return { ok: false, skipped: true, reason: "Médium nebylo nalezeno" };

  const row = data as unknown as MediaRow;
  // Rejected is a final manual/automatic decision. Approved is intentionally not
  // skipped here: a database default or an older trigger must not be able to
  // bypass moderation for a freshly uploaded row.
  if (row.moderation_status === "rejected") {
    return { ok: true, skipped: true, status: row.moderation_status };
  }

  await supabase
    .from(tableValue)
    .update({ moderation_status: "processing" })
    .eq("id", id);

  const url = mediaUrl(tableValue, row);
  if (!url) {
    const reason = tableValue.endsWith("videos")
      ? "Video nemá náhled pro automatickou kontrolu"
      : "Médium nemá URL";
    await supabase
      .from(tableValue)
      .update({
        moderation_status: "review",
        moderation_reason: reason,
        moderation_checked_at: new Date().toISOString(),
      })
      .eq("id", id);
    const processed = { table: tableValue, id, status: "review" as const, reason };
    await notifyAdmin([processed]);
    return { ok: true, ...processed };
  }

  try {
    const isVideo = tableValue.endsWith("videos");
    const urls = isVideo && suppliedFrameUrls.length > 0
      ? Array.from(new Set(suppliedFrameUrls.filter(Boolean))).slice(0, 8)
      : [url];
    const checks = await Promise.all(urls.map((frameUrl) => moderateImageUrl(frameUrl)));
    const priority: Record<ModerationStatus, number> = {
      pending: 0,
      processing: 0,
      approved: 1,
      review: 2,
      rejected: 3,
      failed: 4,
    };
    const moderation = checks.reduce((worst, current) =>
      priority[current.status] > priority[worst.status] ? current : worst,
    );
    const finalStatus: ModerationStatus = moderation.status;
    const finalReason = isVideo && checks.length > 1 && moderation.status === "approved"
      ? `Automaticky schváleno po kontrole ${checks.length} snímků napříč videem.`
      : moderation.reason;
    const storedResult = isVideo
      ? {
          sampled_frames: checks.length,
          frame_urls: urls,
          results: checks.map((check, index) => ({
            frame: index + 1,
            status: check.status,
            reason: check.reason,
            result: check.result,
          })),
        }
      : moderation.result;

    await supabase
      .from(tableValue)
      .update({
        moderation_status: finalStatus,
        moderation_reason: finalReason,
        moderation_provider: "openai:omni-moderation-latest",
        moderation_result: storedResult,
        moderation_checked_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (tableValue === "offer_images" && moderation.status === "rejected") {
      const { data: rejectedImage } = await supabase
        .from("offer_images")
        .select("offer_id, image_url")
        .eq("id", id)
        .single();
      if (rejectedImage) {
        const { data: offer } = await supabase
          .from("offers")
          .select("primary_image_url")
          .eq("id", rejectedImage.offer_id)
          .single();
        if (offer?.primary_image_url === rejectedImage.image_url) {
          const { data: replacement } = await supabase
            .from("offer_images")
            .select("image_url")
            .eq("offer_id", rejectedImage.offer_id)
            .in("moderation_status", ["approved", "pending", "processing", "failed"])
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle();
          await supabase
            .from("offers")
            .update({ primary_image_url: replacement?.image_url || null })
            .eq("id", rejectedImage.offer_id);
        }
      }
    }

    const processed = {
      table: tableValue,
      id,
      status: finalStatus,
      reason: finalReason,
    };
    await notifyAdmin([processed]);
    return { ok: true, ...processed };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Kontrola média selhala";
    await supabase
      .from(tableValue)
      .update({
        moderation_status: "failed",
        moderation_reason: reason,
        moderation_checked_at: new Date().toISOString(),
      })
      .eq("id", id);
    const processed = { table: tableValue, id, status: "failed" as const, reason };
    await notifyAdmin([processed]);
    return { ok: false, ...processed };
  }
}

export async function processPendingMedia(limitPerTable = 10) {
  const supabase = createSupabaseAdminClient();
  const processed: Array<{ table: ModerationTable; id: string; status: ModerationStatus; reason: string | null }> = [];

  for (const table of MODERATION_TABLES) {
    const select = table.endsWith("videos")
      ? "id, video_url, thumbnail_url, moderation_status"
      : "id, image_url, moderation_status";
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: true })
      .limit(limitPerTable);

    if (error) throw new Error(`${table}: ${error.message}`);

    for (const rawRow of data || []) {
      const row = rawRow as unknown as MediaRow;
      const url = mediaUrl(table, row);
      if (!url) {
        const reason = table.endsWith("videos")
          ? "Video nemá náhled pro automatickou kontrolu"
          : "Médium nemá URL";
        await supabase.from(table).update({ moderation_status: "review", moderation_reason: reason, moderation_checked_at: new Date().toISOString() }).eq("id", row.id);
        processed.push({ table, id: row.id, status: "review", reason });
        continue;
      }

      try {
        const moderation = await moderateImageUrl(url);
        await supabase.from(table).update({
          moderation_status: moderation.status,
          moderation_reason: moderation.reason,
          moderation_provider: "openai:omni-moderation-latest",
          moderation_result: moderation.result,
          moderation_checked_at: new Date().toISOString(),
        }).eq("id", row.id);

        if (table === "offer_images" && moderation.status === "rejected") {
          const { data: rejectedImage } = await supabase.from("offer_images").select("offer_id, image_url").eq("id", row.id).single();
          if (rejectedImage) {
            const { data: offer } = await supabase.from("offers").select("primary_image_url").eq("id", rejectedImage.offer_id).single();
            if (offer?.primary_image_url === rejectedImage.image_url) {
              const { data: replacement } = await supabase.from("offer_images")
                .select("image_url")
                .eq("offer_id", rejectedImage.offer_id)
                .in("moderation_status", ["approved", "pending", "processing", "failed"])
                .order("sort_order", { ascending: true })
                .limit(1)
                .maybeSingle();
              await supabase.from("offers").update({ primary_image_url: replacement?.image_url || null }).eq("id", rejectedImage.offer_id);
            }
          }
        }

        processed.push({ table, id: row.id, status: moderation.status, reason: moderation.reason });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Kontrola média selhala";
        await supabase.from(table).update({ moderation_status: "failed", moderation_reason: reason, moderation_checked_at: new Date().toISOString() }).eq("id", row.id);
        processed.push({ table, id: row.id, status: "failed", reason });
      }
    }
  }

  await notifyAdmin(processed);
  return { ok: true, processed, count: processed.length };
}

async function syncOfferPrimaryImageAfterModeration(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  imageId: string,
  status: "approved" | "rejected",
) {
  const { data: image, error: imageError } = await supabase
    .from("offer_images")
    .select("offer_id, image_url")
    .eq("id", imageId)
    .single();

  if (imageError || !image) return;

  const { data: offer } = await supabase
    .from("offers")
    .select("primary_image_url")
    .eq("id", image.offer_id)
    .single();

  if (status === "approved" && !offer?.primary_image_url) {
    await supabase
      .from("offers")
      .update({ primary_image_url: image.image_url })
      .eq("id", image.offer_id);
    return;
  }

  if (status !== "rejected" || offer?.primary_image_url !== image.image_url) return;

  const { data: replacement } = await supabase
    .from("offer_images")
    .select("image_url")
    .eq("offer_id", image.offer_id)
    .in("moderation_status", ["approved", "pending", "processing", "failed"])
    .neq("id", imageId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("offers")
    .update({ primary_image_url: replacement?.image_url || null })
    .eq("id", image.offer_id);
}

export async function setMediaModerationStatus(tableValue: string, id: string, status: "approved" | "rejected") {
  if (!isModerationTable(tableValue)) throw new Error("Neplatný typ média");
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(tableValue).update({
    moderation_status: status,
    moderation_reason: status === "approved" ? "Schváleno administrátorem" : "Zamítnuto administrátorem",
    moderation_checked_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error(error.message);

  if (tableValue === "offer_images") {
    await syncOfferPrimaryImageAfterModeration(supabase, id, status);
  }

  return { ok: true, status };
}

export async function requireModerator() {
  const { requireUser } = await import("@/lib/supabase/server");
  const { user } = await requireUser();
  const configured = (process.env.ADMIN_EMAILS || "info@koluj.cz")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!user.email || !configured.includes(user.email.toLowerCase())) throw new Error("Unauthorized");
  return user;
}


export async function processMediaById(tableValue: string, id: string) {
  return processMedia(tableValue, id);
}

export async function processVideoMediaById(tableValue: string, id: string, frameUrls: string[]) {
  return processMedia(tableValue, id, frameUrls);
}
