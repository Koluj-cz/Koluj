import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.koluj.cz").replace(/\/$/, "");

const staticRoutes = [
  "",
  "/offers",
  "/legal/terms",
  "/legal/privacy",
  "/legal/cookies",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/offers" ? "daily" : "monthly",
    priority: route === "" ? 1 : route === "/offers" ? 0.9 : 0.3,
  }));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return staticPages;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: offers } = await supabaseAdmin
    .from("offers")
    .select("id, created_at")
    .eq("publication_status", "active")
    .eq("hidden_by_account_deactivation", false)
    .order("created_at", { ascending: false })
    .limit(5000);

  const offerPages: MetadataRoute.Sitemap =
    offers?.map((offer) => ({
      url: `${siteUrl}/offers/${offer.id}`,
      lastModified: offer.created_at ? new Date(offer.created_at) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    })) || [];

  return [...staticPages, ...offerPages];
}
