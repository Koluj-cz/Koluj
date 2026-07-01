import BackLink from "@/app/components/BackLink";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <div className="koluj-shell max-w-5xl py-12">
        <BackLink href="/">Zpět na hlavní stránku</BackLink>

        <section className="koluj-card mt-10 p-6 md:p-10">
          <p className="text-sm font-black uppercase tracking-widest text-[var(--koluj-green)]">
            Právní informace
          </p>

          <h1 className="koluj-heading mt-3">Ochrana osobních údajů</h1>

          <div className="mt-10 space-y-8 text-lg leading-relaxed text-[var(--koluj-muted)]">
            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                Jaké údaje zpracováváme
              </h2>
              <p className="mt-3">
                Zpracováváme zejména e-mail, jméno, profilové údaje, lokalitu,
                informace o nabízených nabídkách, rezervacích, hodnoceních,
                notifikacích a komunikaci mezi uživateli.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                Proč údaje zpracováváme
              </h2>
              <p className="mt-3">
                Údaje používáme pro vytvoření účtu, provoz služby, komunikaci
                mezi uživateli, bezpečnost, zasílání systémových notifikací a
                zlepšování aplikace Koluj.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                Sdílení údajů
              </h2>
              <p className="mt-3">
                Osobní údaje neprodáváme třetím stranám. Některé údaje mohou být
                viditelné ostatním uživatelům, například jméno, veřejný profil,
                hodnocení nebo nabídky nabídek.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                Práva uživatele
              </h2>
              <p className="mt-3">
                Máte právo požádat o přístup ke svým údajům, opravu, výmaz,
                omezení zpracování nebo přenositelnost údajů. Žádost můžete
                poslat na info@koluj.cz.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[var(--koluj-text)]">
                Uchování údajů
              </h2>
              <p className="mt-3">
                Údaje uchováváme po dobu existence účtu nebo po dobu nezbytnou
                pro ochranu práv, bezpečnost služby a splnění zákonných
                povinností.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}