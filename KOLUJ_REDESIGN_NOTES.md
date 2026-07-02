# KOLUJ redesign

Kompletní vizuální přestavba do měkkého futuristického stylu:

- nový globální design systém v `app/globals.css`,
- sjednocené šířky wrapperů `koluj-shell` / `koluj-shell-wide`,
- skleněné karty, měkčí pozadí, nové stíny, radiusy a animace,
- nová homepage ve stylu skici s hero scénou, vyhledáváním, kategoriemi, komunitní sekcí a statistikami,
- přepracovaná `OfferCard` pro nabídky, služby i owner variantu,
- sjednocený `OfferSearchFilters`,
- upravený `BackLink`,
- globální mobilní spodní navigace `BottomNav`,
- odstraněna závislost na Google Fonts v `layout.tsx`, aby build nebyl blokovaný bez externího font fetchingu.

Ověření:

- `npx tsc --noEmit` prošlo.
- `next build` v sandboxu prošel přes kompilaci i TypeScript, ale worker byl ukončen prostředím při sběru page dat. Na lokálu/Vercelu by už neměl padat kvůli Google Fonts.
