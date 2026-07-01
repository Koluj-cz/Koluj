# KOLUJ 2.0 refactor notes

## Co je součástí balíku

- databázová migrace na čisté názvosloví:
  - `item_id` -> `offer_id`
  - `loan_id` -> `booking_id`
  - `borrower_id` -> `customer_id`
- přejmenování hlavních souborů a komponent:
  - `ItemCard` -> `OfferCard`
  - `loanService` -> `bookingService`
  - `loanReminderService` -> `bookingReminderService`
  - `itemService` -> `offerService`
  - `ItemsMap` -> `OffersMap`
  - `AddItemButton` -> `AddOfferButton`
  - `AddItemDashboardCard` -> `AddOfferDashboardCard`
- úpravy API, notifikací, cron připomínek a dashboardu na `booking/offer/customer` terminologii.
- služba bez fotky už nezobrazuje velký prázdný blok „Bez fotky“, ale kategorický fallback hero/placeholder.

## Pořadí nasazení

1. Zálohuj databázi.
2. Spusť SQL migraci:

```txt
supabase/migrations/20260711_koluj_20_booking_offer_column_refactor.sql
```

3. Až potom nahraď soubory z tohoto balíku.
4. Spusť:

```bash
npm install
npm run build
```

## Ověření

Lokálně prošlo:

```bash
npx tsc --noEmit
```

`npm run build` v sandboxu spadl jen na nedostupném stahování Google Fonts (`next/font/google`). TypeScript chyby se neobjevily.

## Poznámka ke službám

Tento balík sjednocuje názvosloví a opravuje zobrazení služeb bez fotky. Hodinový rezervační kalendář pro služby je další samostatný krok, protože musí upravit nejen UI, ale i výpočty dostupnosti, překryvy rezervací, schvalování a cron připomínky podle `starts_at` / `ends_at`.
