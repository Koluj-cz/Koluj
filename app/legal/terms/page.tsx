import BackLink from "@/app/components/BackLink";

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <div className="koluj-shell max-w-5xl py-12">
        <BackLink href="/">Zpět na hlavní stránku</BackLink>

        <section className="koluj-card mt-10 p-6 md:p-10">
          <p className="text-sm font-black uppercase tracking-widest text-[var(--koluj-green)]">
            Právní informace
          </p>

          <h1 className="koluj-heading mt-3">Podmínky používání</h1>

          <p className="mt-4 text-[var(--koluj-muted)]">
            Poslední aktualizace: {new Date().toLocaleDateString("cs-CZ")}
          </p>

          <div className="mt-10 space-y-8 text-lg leading-relaxed text-[var(--koluj-muted)]">
            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                1. O službě Koluj
              </h2>
              <p className="mt-3">
                Koluj je online platforma umožňující uživatelům nabízet a
                půjčovat si věci mezi sebou. Služba slouží ke zprostředkování
                kontaktu mezi uživateli.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                2. Koluj není stranou půjčky
              </h2>
              <p className="mt-3">
                Koluj není účastníkem půjčky, kupní smlouvy ani jiné dohody
                uzavírané mezi uživateli. Veškeré dohody, předání, platby,
                kauce, vrácení a případné nároky řeší uživatelé mezi sebou.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                3. Odpovědnost uživatelů
              </h2>
              <p className="mt-3">
                Každý uživatel odpovídá za pravdivost zveřejněných údajů, stav
                nabízených věcí, dodržení domluvy, bezpečné předání a vrácení
                věci. Uživatelé používají službu na vlastní odpovědnost.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                4. Omezení odpovědnosti
              </h2>
              <p className="mt-3">
                Koluj neověřuje vlastnictví nabízených věcí, negarantuje stav
                věcí, identitu uživatelů, jejich spolehlivost ani splnění
                domluvených podmínek. Koluj nenese odpovědnost za ztrátu,
                poškození, nevrácení věci, škodu, ušlý zisk ani jiné nároky
                vzniklé mezi uživateli.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                5. Zakázaný obsah
              </h2>
              <p className="mt-3">
                Je zakázáno zveřejňovat nezákonný, podvodný, rasistický,
                nenávistný, sexuální, výhružný nebo jinak škodlivý obsah.
                Koluj může takový obsah odstranit a účet omezit nebo zablokovat.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                6. Změny podmínek
              </h2>
              <p className="mt-3">
                Koluj si vyhrazuje právo službu i tyto podmínky upravovat.
                Aktuální znění je vždy dostupné na této stránce.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}