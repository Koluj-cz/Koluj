import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeSearchText } from "@/lib/services/searchIntentService";

export async function replaceSearchIntentChildren(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  intentId: string,
  body: Record<string, unknown>,
) {
  const keywords = Array.isArray(body.keywords) ? body.keywords : [];
  const recommendations = Array.isArray(body.recommendations) ? body.recommendations : [];

  const keywordRows = keywords
    .map((value, index) => ({
      intent_id: intentId,
      keyword: String(value).trim(),
      normalized_keyword: normalizeSearchText(String(value)),
      sort_order: index,
    }))
    .filter((row) => row.normalized_keyword);

  if (keywordRows.length) {
    const { error } = await supabase.from("search_intent_keywords").insert(keywordRows);
    if (error) throw error;
  }

  const recommendationRows = recommendations
    .map((value, index) => {
      const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return {
        intent_id: intentId,
        label: String(item.label || "").trim(),
        offer_type: item.offerType === "item" || item.offerType === "service" ? item.offerType : null,
        category: String(item.category || "").trim() || null,
        search_query: String(item.searchQuery || "").trim() || null,
        sort_order: index,
      };
    })
    .filter((row) => row.label);

  if (recommendationRows.length) {
    const { error } = await supabase.from("search_intent_recommendations").insert(recommendationRows);
    if (error) throw error;
  }
}
