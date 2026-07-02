# KOLUJ redesign update

Upraveno v tomto balíku:

- hlavní stránka je nově full-screen a není uzavřená do úzkého boxu,
- odstraněné opakující se mřížkové pozadí,
- hero část používá čistou CSS/Lucide orbitální scénu místo AI obrázků,
- odstraněné vymyšlené statistiky o uživatelích, půjčkách a CO2,
- ponechané karty nabídek,
- globální design systém sjednocený přes `app/globals.css`,
- dashboard přepsaný do stejného vizuálního směru,
- zachovaná původní funkcionalita a napojení na Supabase.

Kontrola:

- `npx tsc --noEmit` prošlo.
- `npm run build` se v sandboxu nedokončil kvůli timeoutu při Next.js `Collecting page data`, ne kvůli TypeScript chybě.
