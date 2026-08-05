import type { SupabaseClient } from "@supabase/supabase-js";

export type SearchIntentRecommendation = {
  id: string;
  label: string;
  offerType: "item" | "service" | null;
  category: string | null;
  searchQuery: string | null;
};

export type SearchIntentMatch = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  recommendations: SearchIntentRecommendation[];
};

type KeywordRow = {
  keyword: string;
  normalized_keyword: string;
  sort_order: number;
};

type RecommendationRow = {
  id: string;
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
  search_intent_keywords: KeywordRow[] | null;
  search_intent_recommendations: RecommendationRow[] | null;
};

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findSearchIntent(
  supabase: SupabaseClient,
  rawQuery: string,
): Promise<SearchIntentMatch | null> {
  const query = normalizeSearchText(rawQuery);
  if (query.length < 3) return null;

  const { data, error } = await supabase
    .from("search_intents")
    .select(`
      id,
      name,
      slug,
      description,
      priority,
      search_intent_keywords (
        keyword,
        normalized_keyword,
        sort_order
      ),
      search_intent_recommendations (
        id,
        label,
        offer_type,
        category,
        search_query,
        sort_order
      )
    `)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (error) throw error;

  const intents = (data ?? []) as unknown as IntentRow[];
  let best: { intent: IntentRow; score: number } | null = null;

  for (const intent of intents) {
    for (const keyword of intent.search_intent_keywords ?? []) {
      const normalizedKeyword = normalizeSearchText(
        keyword.normalized_keyword || keyword.keyword,
      );
      if (!normalizedKeyword || !query.includes(normalizedKeyword)) continue;

      const wordBonus = normalizedKeyword.includes(" ") ? 100 : 0;
      const exactBonus = query === normalizedKeyword ? 200 : 0;
      const score = exactBonus + wordBonus + normalizedKeyword.length + intent.priority;
      if (!best || score > best.score) best = { intent, score };
    }
  }

  if (!best) return null;

  return {
    id: best.intent.id,
    name: best.intent.name,
    slug: best.intent.slug,
    description: best.intent.description,
    recommendations: [...(best.intent.search_intent_recommendations ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        id: item.id,
        label: item.label,
        offerType: item.offer_type,
        category: item.category,
        searchQuery: item.search_query,
      })),
  };
}
