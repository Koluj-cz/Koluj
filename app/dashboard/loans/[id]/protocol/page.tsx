import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrintButton from "@/app/components/PrintButton";
import { categoryLabels } from "@/lib/constants";
import BackLink from "@/app/components/BackLink";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type Loan = {
  id: string;
  owner_id: string | null;
  borrower_id: string | null;
  status: string;
  items: {
    id: string;
    title: string;
    category: string | null;
    pickup_place: string | null;
    price_amount: number | null;
    price_unit: string | null;
    deposit: number | null;
  } | null;
  owner: Profile | null;
  borrower: Profile | null;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function valueOrLine(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "_______________________";
  return value;
}

function Checkbox({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2">
      <span className="inline-block h-3 w-3 shrink-0 border border-black" />
      <span>{label}</span>
    </p>
  );
}

function WriteBox({ label, height = "h-16" }: { label: string; height?: string }) {
  return (
    <div className={`${height} border border-black p-2`}>
      <span className="font-bold">{label}</span>
    </div>
  );
}

export default async function LoanHandoverProtocolPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("loans")
    .select(`
      id,
      owner_id,
      borrower_id,
      status,
      items (
        id,
        title,
        category,
        pickup_place,
        price_amount,
        price_unit,
        deposit
      ),
      owner:profiles!loans_owner_id_fkey (
        id,
        full_name,
        phone,
        email
      ),
      borrower:profiles!loans_borrower_id_fkey (
        id,
        full_name,
        phone,
        email
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const loan = data as unknown as Loan;

  if (loan.owner_id !== user.id) {
    redirect(`/dashboard/loans/${loan.id}`);
  }

  const categoryLabel = loan.items?.category
    ? categoryLabels[loan.items.category] || loan.items.category
    : "—";

  return (
    <main className="min-h-screen bg-[#efebdd] print:bg-white">
      <div className="mx-auto max-w-[980px] px-4 py-8 print:hidden">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <BackLink href={`/dashboard/loans/${loan.id}`}>Zpět na půjčku</BackLink>
          
<PrintButton />
        </div>
      </div>

      <article className="mx-auto max-w-[794px] bg-white p-8 text-[9px] leading-tight text-black shadow-sm print:m-0 print:max-w-none print:p-0 print:text-[8.5px] print:shadow-none">
        <header className="mb-6 flex items-start justify-between border-b border-black pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em]">KOLUJ</p>
            <h1 className="mt-2 text-2xl font-black">Protokol o předání věci</h1>
            <p className="mt-2 max-w-[560px] text-[11px] leading-relaxed">
              Tento protokol potvrzuje fyzické předání předmětu půjčky mezi vlastníkem
              a půjčujícím. Půjčující podpisem potvrzuje převzetí věci, její stav při
              předání a odpovědnost za její vrácení.
            </p>
          </div>

          <div className="text-right text-[10px]">
            <p className="font-bold">ID půjčky</p>
            <p>{loan.id}</p>
          </div>
        </header>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-black uppercase">1. Identifikace půjčky</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <p><strong>ID půjčky:</strong> {loan.id}</p>
            <p><strong>Název věci:</strong> {valueOrLine(loan.items?.title)}</p>
            <p><strong>Kategorie:</strong> {categoryLabel}</p>
            <p><strong>Celková cena půjčení:</strong> _______________________ Kč</p>
            <p><strong>Kauce:</strong> {loan.items?.deposit || 0} Kč</p>
            <p><strong>Místo předání:</strong> {valueOrLine(loan.items?.pickup_place)}</p>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-8">
          <div>
            <h2 className="mb-2 text-sm font-black uppercase">2. Vlastník</h2>
            <div className="space-y-1">
              <p><strong>Jméno:</strong> _______________________</p>
              <p><strong>Telefon:</strong> {valueOrLine(loan.owner?.phone)}</p>
              <p><strong>E-mail:</strong> {valueOrLine(loan.owner?.email)}</p>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-black uppercase">3. Půjčující</h2>
            <div className="space-y-1">
              <p><strong>Jméno:</strong> _______________________</p>
              <p><strong>Telefon:</strong> {valueOrLine(loan.borrower?.phone)}</p>
              <p><strong>E-mail:</strong> {valueOrLine(loan.borrower?.email)}</p>
            </div>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-black uppercase">4. Ověření totožnosti půjčujícího</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <Checkbox label="Totožnost ověřena dle občanského průkazu" />
            <Checkbox label="Totožnost nebyla ověřena" />
            <p><strong>Číslo OP / poslední 4 znaky:</strong> _______________________</p>
            <p><strong>Platnost dokladu do:</strong> _______________________</p>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-black uppercase">5. Stav věci při předání</h2>
          <p className="mb-2">
            Půjčující potvrzuje, že si věc při převzetí prohlédl a přebírá ji ve stavu
            uvedeném níže.
          </p>
          <WriteBox label="Stav věci při předání:" height="h-20" />
          <div className="mt-2">
            <WriteBox label="Viditelné vady / opotřebení:" height="h-16" />
          </div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-8">
          <div>
            <h2 className="mb-2 text-sm font-black uppercase">6. Fotodokumentace</h2>
            <div className="space-y-2">
              <Checkbox label="Fotografie byly pořízeny při předání" />
              <Checkbox label="Fotografie nebyly pořízeny" />
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-black uppercase">7. Kauce</h2>
            <div className="space-y-2">
              <Checkbox label="Kauce převzata v hotovosti" />
              <Checkbox label="Kauce uhrazena převodem" />
              <Checkbox label="Kauce není požadována" />
            </div>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-black uppercase">8. Prohlášení půjčujícího</h2>
          <p className="leading-relaxed">
            Potvrzuji, že jsem převzal/a uvedenou věc ve stavu popsaném v tomto
            protokolu. Byl/a jsem seznámen/a s jejím používáním a zavazuji se ji vrátit
            ve sjednaném termínu. Beru na vědomí odpovědnost za škodu způsobenou
            ztrátou, odcizením nebo poškozením nad rámec běžného opotřebení.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-black uppercase">9. Poznámky</h2>
          <WriteBox label="Další ujednání / poznámky:" height="h-16" />
        </section>

        <section className="mt-6 grid grid-cols-2 gap-14 text-xs">
          <div>
            <div className="border-t border-black pt-3">Podpis vlastníka</div>
          </div>
          <div>
            <div className="border-t border-black pt-3">Podpis půjčujícího</div>
          </div>
        </section>

        <footer className="mt-5 border-t border-black pt-2 text-[8px] leading-tight">
          Tento protokol byl vytvořen prostřednictvím platformy KOLUJ a potvrzuje fyzické
          předání předmětu půjčky mezi oběma stranami.
        </footer>
      </article>
    </main>
  );
}
