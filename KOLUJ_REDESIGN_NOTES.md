# Koluj UI redesign v3

This package applies a new fullscreen visual direction while preserving existing Supabase/API functionality.

Changed:
- Rebuilt the global visual system in `app/globals.css`.
- Rebuilt the homepage in `app/page.tsx` around a fullscreen hero, real offer data, and no fake public statistics.
- Kept real uploaded offer images only; the hero uses CSS + lucide icons, not generated images.
- Preserved existing routing, API calls, auth, offer loading, search, location sorting and offer cards.
- Kept existing dashboard/booking/form functionality but restyled shared classes globally so screens are visually unified.

Validation:
- `npx tsc --noEmit` passed.
- `npm run build` was started after `npm ci`, but the sandbox timed out during Next production build. No TypeScript errors were reported.
