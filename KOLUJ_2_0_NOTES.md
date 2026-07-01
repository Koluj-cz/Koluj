# KOLUJ 2.0 refactor notes

Tento balík převádí projekt směrem na jednotný model **nabídky = věci + služby**.

## Nejdřív spusť SQL migraci

Soubor:

`supabase/migrations/20260710_koluj_20_offers_services.sql`

Migrace:
- přejmenuje `items` na `offers`,
- přejmenuje `item_images` na `offer_images`,
- přejmenuje dostupnostní tabulky na `offer_*`,
- přejmenuje `loans` na `bookings`,
- přejmenuje zprávy/připomínky/presence na `booking_*`,
- přidá `offer_type` (`item` / `service`),
- přidá přípravu pro služby (`service_duration_minutes`, `service_location_type`),
- přidá `starts_at` / `ends_at` do rezervací pro budoucí hodinové služby.

## Proč zůstávají některé interní názvy

Kvůli bezpečné migraci nejsou v této fázi přejmenované sloupce `item_id`, `loan_id` a některé interní TypeScript proměnné. Tabulky a route cesty už jsou přejmenované, ale sloupce zůstávají kompatibilní, aby se minimalizovalo riziko rozbití projektu.

Další čistící krok může být:
- `item_id` → `offer_id`,
- `loan_id` → `booking_id`,
- `borrower_id` → `customer_id`,
- `ItemCard` → `OfferCard`,
- `loanService` → `bookingService`.

## Cron

Cron je přesunutý na:

`/api/cron/booking-reminders`

`vercel.json` je upravený na novou cestu.

## Kontrola

Lokálně prošel:

`npx tsc --noEmit`

`npm run build` v sandboxu spadne pouze na nedostupných Google Fonts (`next/font`), stejně jako dříve v tomto prostředí.
