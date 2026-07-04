import BackLink from "@/app/components/BackLink";

export default function CookiesPage() {
  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10 py-8 md:py-10">
        <BackLink href="/">Zpět na hlavní stránku</BackLink>

        <section className="koluj-hero-card mt-6 p-6 md:p-10">
          <p className="text-sm font-black uppercase tracking-widest text-[var(--koluj-green)]">
            Právní informace
          </p>

          <h1 className="koluj-heading mt-3">Cookies</h1>

          <div className="mt-10 space-y-8 text-lg leading-relaxed text-[var(--koluj-muted)]">
            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                Co jsou cookies
              </h2>
              <p className="mt-3">
                Cookies jsou malé soubory ukládané v prohlížeči. Pomáhají nám
                zajistit správné fungování aplikace, přihlášení uživatele a
                bezpečnost služby.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                Nezbytné cookies
              </h2>
              <p className="mt-3">
                Tyto cookies jsou nutné pro fungování služby Koluj. Bez nich by
                nebylo možné zajistit například přihlášení, zabezpečení nebo
                základní funkce aplikace.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                Analytické cookies
              </h2>
              <p className="mt-3">
                Analytické cookies můžeme používat pro anonymní statistiky a
                zlepšování služby. Pokud je zapneme, budeme je používat pouze na
                základě souhlasu uživatele.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                Nastavení cookies
              </h2>
              <p className="mt-3">
                Nezbytné cookies nelze vypnout, protože jsou potřeba pro
                fungování aplikace. Ostatní cookies můžete odmítnout v cookie
                liště.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}