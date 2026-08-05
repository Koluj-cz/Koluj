import { redirect } from "next/navigation";
import BackLink from "@/app/components/BackLink";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";
import SearchIntentAdmin, { type IntentEditorRow } from "./SearchIntentAdmin";

export const dynamic = "force-dynamic";

type KeywordRow = { keyword: string; sort_order: number };
type RecommendationRow = {
  label: string;
  offer_type: "item" | "service" | null;
  category: string | null;
  search_query: string | null;
  sort_order: number;
};
type IntentRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  search_intent_keywords: KeywordRow[] | null;
  search_intent_recommendations: RecommendationRow[] | null;
};

export default async function SearchIntentsAdminPage() {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }

  const { data, error } = await createSupabaseAdminClient()
    .from("search_intents")
    .select(`
      id, name, slug, description, priority, is_active,
      search_intent_keywords (keyword, sort_order),
      search_intent_recommendations (label, offer_type, category, search_query, sort_order)
    `)
    .order("priority", { ascending: false })
    .order("name");
  if (error) throw error;

  const initialIntents: IntentEditorRow[] = ((data ?? []) as unknown as IntentRow[]).map((intent) => ({
    id: intent.id,
    name: intent.name,
    slug: intent.slug,
    description: intent.description || "",
    priority: intent.priority,
    isActive: intent.is_active,
    keywords: [...(intent.search_intent_keywords ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => item.keyword),
    recommendations: [...(intent.search_intent_recommendations ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        label: item.label,
        offerType: item.offer_type || "",
        category: item.category || "",
        searchQuery: item.search_query || "",
      })),
  }));

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8">
          <BackLink href="/dashboard">Dashboard</BackLink>
          <h1 className="koluj-heading mt-7">Chytré vyhledávání</h1>
          <p className="mt-3 max-w-3xl text-[var(--koluj-muted)] md:text-lg">
            Spravuj fráze, podle kterých Koluj rozpozná záměr uživatele, a nabídni mu vhodné kategorie a služby bez placeného AI modelu.
          </p>
        </section>
        <SearchIntentAdmin initialIntents={initialIntents} />
      </div>
    </main>
  );
}
