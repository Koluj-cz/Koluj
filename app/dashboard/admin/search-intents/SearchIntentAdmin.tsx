"use client";

import { useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  categories,
  categoryLabels,
  serviceCategories,
  serviceCategoryLabels,
} from "@/lib/constants";

type Recommendation = {
  label: string;
  offerType: "item" | "service" | "";
  category: string;
  searchQuery: string;
};

export type IntentEditorRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  priority: number;
  isActive: boolean;
  keywords: string[];
  recommendations: Recommendation[];
};

const emptyIntent: IntentEditorRow = {
  id: "",
  name: "",
  slug: "",
  description: "",
  priority: 0,
  isActive: true,
  keywords: [],
  recommendations: [],
};

export default function SearchIntentAdmin({ initialIntents }: { initialIntents: IntentEditorRow[] }) {
  const [intents, setIntents] = useState(initialIntents);
  const [selectedId, setSelectedId] = useState(initialIntents[0]?.id || "new");
  const [draft, setDraft] = useState<IntentEditorRow>(initialIntents[0] || emptyIntent);
  const [keywordInput, setKeywordInput] = useState("");
  const [busy, setBusy] = useState(false);

  function selectIntent(intent: IntentEditorRow) {
    setSelectedId(intent.id);
    setDraft({ ...intent, keywords: [...intent.keywords], recommendations: intent.recommendations.map((item) => ({ ...item })) });
    setKeywordInput("");
  }

  function createNew() {
    setSelectedId("new");
    setDraft({ ...emptyIntent, recommendations: [] });
    setKeywordInput("");
  }

  function addKeyword() {
    const values = keywordInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!values.length) return;
    setDraft((current) => ({
      ...current,
      keywords: Array.from(new Set([...current.keywords, ...values])),
    }));
    setKeywordInput("");
  }

  function addRecommendation() {
    setDraft((current) => ({
      ...current,
      recommendations: [
        ...current.recommendations,
        { label: "", offerType: "", category: "", searchQuery: "" },
      ],
    }));
  }

  async function save() {
    if (!draft.name.trim() || !draft.slug.trim()) {
      toast.error("Vyplň název a slug.");
      return;
    }
    if (!draft.keywords.length) {
      toast.error("Přidej alespoň jedno klíčové slovo.");
      return;
    }

    setBusy(true);
    try {
      const isNew = selectedId === "new";
      const response = await fetch(
        isNew ? "/api/admin/search-intents" : `/api/admin/search-intents/${selectedId}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Záměr se nepodařilo uložit");

      const saved = { ...draft, id: isNew ? String(body.id) : selectedId };
      setIntents((current) =>
        isNew ? [...current, saved] : current.map((item) => item.id === selectedId ? saved : item),
      );
      setSelectedId(saved.id);
      setDraft(saved);
      toast.success("Chytré hledání bylo uloženo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Záměr se nepodařilo uložit");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (selectedId === "new") return;
    if (!window.confirm(`Opravdu smazat záměr „${draft.name}“?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/search-intents/${selectedId}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Záměr se nepodařilo smazat");
      const next = intents.filter((item) => item.id !== selectedId);
      setIntents(next);
      if (next[0]) selectIntent(next[0]); else createNew();
      toast.success("Záměr byl smazán");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Záměr se nepodařilo smazat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="koluj-card h-fit overflow-hidden p-4">
        <button type="button" onClick={createNew} className="koluj-button mb-4 w-full px-4 py-3">
          <Plus size={18} /> Nový záměr
        </button>
        <div className="space-y-2">
          {intents.map((intent) => (
            <button
              key={intent.id}
              type="button"
              onClick={() => selectIntent(intent)}
              className={`w-full rounded-2xl px-4 py-3 text-left transition ${selectedId === intent.id ? "bg-[var(--koluj-green)] text-white" : "hover:bg-[var(--koluj-bg)]"}`}
            >
              <p className="font-black">{intent.name}</p>
              <p className={`mt-1 text-xs font-bold ${selectedId === intent.id ? "text-white/75" : "text-[var(--koluj-muted)]"}`}>
                {intent.keywords.length} klíčových slov · {intent.recommendations.length} doporučení
              </p>
            </button>
          ))}
          {!intents.length && <p className="p-4 text-sm text-[var(--koluj-muted)]">Zatím nejsou vytvořené žádné záměry.</p>}
        </div>
      </aside>

      <div className="koluj-card min-w-0 p-5 md:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-black">Název</span>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="koluj-input" placeholder="Např. Malování" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black">Slug</span>
            <input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} className="koluj-input" placeholder="malovani" />
          </label>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-black">Krátké vysvětlení</span>
          <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="koluj-input min-h-24" placeholder="Co uživateli doporučíme a proč." />
        </label>

        <div className="mt-5 grid gap-5 sm:grid-cols-[160px_1fr]">
          <label className="block">
            <span className="mb-2 block text-sm font-black">Priorita</span>
            <input type="number" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })} className="koluj-input" />
          </label>
          <label className="flex items-end gap-3 pb-3 font-black">
            <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="h-5 w-5 accent-[var(--koluj-green)]" />
            Aktivní a veřejně používaný
          </label>
        </div>

        <div className="mt-8 border-t border-[var(--koluj-border)] pt-7">
          <h2 className="text-xl font-black">Klíčová slova a fráze</h2>
          <p className="mt-1 text-sm text-[var(--koluj-muted)]">Vyhledávání ignoruje diakritiku a velikost písmen.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addKeyword(); } }}
              className="koluj-input"
              placeholder="malovat, vymalovat, natřít"
            />
            <button type="button" onClick={addKeyword} className="koluj-button-secondary shrink-0 px-4">Přidat</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.keywords.map((keyword) => (
              <span key={keyword} className="inline-flex items-center gap-2 rounded-full bg-[var(--koluj-bg)] px-3 py-2 text-sm font-black">
                {keyword}
                <button type="button" onClick={() => setDraft({ ...draft, keywords: draft.keywords.filter((item) => item !== keyword) })} aria-label={`Odebrat ${keyword}`}><X size={15} /></button>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--koluj-border)] pt-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Doporučení</h2>
              <p className="mt-1 text-sm text-[var(--koluj-muted)]">Kliknutí uživateli nastaví typ, kategorii a volitelně hledaný text.</p>
            </div>
            <button type="button" onClick={addRecommendation} className="koluj-button-secondary px-4 py-2.5"><Plus size={17} /> Přidat doporučení</button>
          </div>

          <div className="mt-5 space-y-4">
            {draft.recommendations.map((recommendation, index) => {
              const categoryOptions = recommendation.offerType === "service"
                ? serviceCategories.map((value) => ({ value, label: serviceCategoryLabels[value] }))
                : categories.map((value) => ({ value, label: categoryLabels[value] }));
              return (
                <div key={index} className="rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <input value={recommendation.label} onChange={(event) => updateRecommendation(index, "label", event.target.value)} className="koluj-input bg-white" placeholder="Popisek tlačítka" />
                    <select value={recommendation.offerType} onChange={(event) => updateRecommendation(index, "offerType", event.target.value)} className="koluj-select bg-white">
                      <option value="">Všechny typy</option><option value="item">Věci</option><option value="service">Služby</option>
                    </select>
                    <select value={recommendation.category} onChange={(event) => updateRecommendation(index, "category", event.target.value)} className="koluj-select bg-white" disabled={!recommendation.offerType}>
                      <option value="">Bez kategorie</option>
                      {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input value={recommendation.searchQuery} onChange={(event) => updateRecommendation(index, "searchQuery", event.target.value)} className="koluj-input bg-white" placeholder="Hledaný text" />
                      <button type="button" onClick={() => setDraft({ ...draft, recommendations: draft.recommendations.filter((_, itemIndex) => itemIndex !== index) })} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700" aria-label="Smazat doporučení"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-[var(--koluj-border)] pt-6">
          <button type="button" onClick={remove} disabled={busy || selectedId === "new"} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-red-100 px-5 font-black text-red-700 disabled:opacity-40"><Trash2 size={18} /> Smazat</button>
          <button type="button" onClick={() => void save()} disabled={busy} className="koluj-button h-12 px-6 disabled:opacity-50"><Save size={18} /> {busy ? "Ukládám…" : "Uložit"}</button>
        </div>
      </div>
    </section>
  );

  function updateRecommendation(index: number, key: keyof Recommendation, value: string) {
    setDraft((current) => ({
      ...current,
      recommendations: current.recommendations.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (key === "offerType") {
          const offerType: Recommendation["offerType"] =
            value === "item" || value === "service" ? value : "";
          return { ...item, offerType, category: "" };
        }
        return { ...item, [key]: value } as Recommendation;
      }),
    }));
  }
}
