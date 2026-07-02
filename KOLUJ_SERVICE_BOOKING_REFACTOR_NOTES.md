# Koluj service booking flow refactor - opravená verze

Co jsem znovu prošel a opravil:

1. Detail nabídky
- Věc používá denní kalendář.
- Služba `price_unit = hour` používá časovou rezervaci.
- Služba `price_unit = piece` je poptávková a zákazníkovi nezobrazuje kalendář.
- Cena hodinové služby se počítá podle minut vybraného rozsahu.

2. Kalendář služby
- Předělaný z mnoha hodinových tlačítek na kompaktní výběr:
  - datum,
  - začátek,
  - konec.
- Časy jsou po 30 minutách.
- Kontroluje kolize s rezervacemi i blokacemi.
- Vlastník může blokovat konkrétní časový rozsah služby.

3. Dostupnost / availability service
- Opravená kontrola kolizí časových služeb bez křehkého `.or(...)` dotazu.
- Denní blokace blokuje i časovou službu v daném dni.
- Časová blokace blokuje jen konkrétní časový rozsah.
- Odstraněná duplicitní hodnota `offerId` v dotazu.

4. Booking flow
- Věc: requested -> approved -> active -> returned.
- Služba: requested -> active -> returned, kde `returned` znamená dokončeno.
- U služby se nepotvrzuje předání.
- U služby se potvrzuje dokončení.
- Systémové zprávy v chatu rozlišují věc a službu.

5. Detail rezervace
- Doplněné zobrazení termínu / času služby.
- U služby se nezobrazuje kauce.
- Texty tlačítek a chyb jsou upravené pro službu vs věc.
- Protokol používá texty pro provedení služby.

6. Notifikace a push
- Opravený zápis push subscription: `onConflict` je teď podle existujícího unikátního sloupce `endpoint`.
- Tohle bylo pravděpodobný důvod, proč e-mail chodil, ale push ne.

7. Cron připomínky
- Věci: 24 h před začátkem a 24 h před vrácením.
- Časové služby: přibližně 1 h před začátkem.
- `reserveReminderSlot` už nejdřív kontroluje existující záznam, takže není závislý jen na unikátním indexu.
- `vercel.json` zůstává na hodinovém cronu.

8. SQL
Spusť migraci:

`supabase/migrations/20260712_booking_reminders_unique_index.sql`

Tato migrace brání duplicitním připomínkám stejné rezervace.

Kontrola:
- `npx tsc --noEmit` prošlo.
- `npm run build` v sandboxu spadne jen kvůli nemožnosti stáhnout Google Fonts bez internetu. TypeScript část je v pořádku.
