# KOLUJ redesign – implementované změny

Tento ZIP obsahuje první implementační iteraci nového designového směru pro KOLUJ.

## Upravené části

- `app/globals.css`
  - nové design tokeny pro moderní minimalistický systém
  - čisté off-white pozadí
  - prémiová tlumená zelená
  - méně stínů, méně skla, méně dekorací
  - jednotné radiusy, inputy, karty, tlačítka, stavy

- `app/components/OfferCard.tsx`
  - nová mobile-first karta nabídky
  - fotografie jako hlavní prvek
  - minimum textu
  - čistší typografie
  - méně rámečků a vizuálního šumu
  - stejný komponent funguje pro public i owner variantu

- `app/components/OfferSearchFilters.tsx`
  - čistší vyhledávací panel
  - méně glass efektů
  - konzistentní input/select prvky

- `app/page.tsx`
  - homepage používá skutečné fotky nabídek
  - odstraněn dekorativní orbit hero jako hlavní vizuál
  - jednodušší hero text
  - čistší CTA a kategorie

## Ověření

- Instalace závislostí přes `npm ci` proběhla úspěšně.
- `next build` prošel kompilací a TypeScriptem s dummy ENV hodnotami.
- Build doběhl až do fáze generování stránek. Next.js hlásí pouze existující varování k `metadata.themeColor` a deprecated `middleware` konvenci.
- `npm run lint` stále hlásí původní lint chyby mimo redesign části projektu, hlavně `no-explicit-any` v API routes a React Compiler pravidla v existujících komponentách.

## Doporučený další krok

Další iteraci bych zaměřil na:

1. detail nabídky (`app/offers/[id]/page.tsx`),
2. dashboard,
3. formuláře přidání/editace nabídky,
4. chat a rezervace,
5. sjednocení všech zbylých starších tříd typu `font-black`, glass efektů a těžkých stínů.
