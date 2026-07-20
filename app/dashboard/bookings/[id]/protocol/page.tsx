import { notFound, redirect } from "next/navigation";
import PrintButton from "@/app/components/PrintButton";
import { categoryLabels, serviceCategoryLabels } from "@/lib/constants";
import BackLink from "@/app/components/BackLink";
import HelpTopic from "@/app/components/help/HelpTopic";
import { requireUser } from "@/lib/supabase/server";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type Booking = {
  id: string;
  owner_id: string | null;
  customer_id: string | null;
  status: string;
  date_from: string | null;
  date_to: string | null;
  starts_at: string | null;
  ends_at: string | null;
  total_price: number | null;
  offers: {
    id: string;
    title: string;
    category: string | null;
    pickup_place: string | null;
    price_amount: number | null;
    price_unit: string | null;
    deposit: number | null;
    offer_type: string | null;
  } | null;
  owner: Profile | null;
  customer: Profile | null;
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

export default async function BookingHandoverProtocolPage({ params }: PageProps) {
  const { id } = await params;
  let auth: Awaited<ReturnType<typeof requireUser>>;

  try {
    auth = await requireUser();
  } catch {
    redirect(`/login?redirectTo=/dashboard/bookings/${id}/protocol`);
  }

  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      owner_id,
      customer_id,
      status,
      date_from,
      date_to,
      starts_at,
      ends_at,
      total_price,
      offers:offers (
        id,
        title,
        category,
        pickup_place,
        price_amount,
        price_unit,
        deposit,
        offer_type
      ),
      owner:profiles!bookings_owner_id_fkey (
        id,
        full_name,
        phone,
        email
      ),
      customer:profiles!bookings_customer_id_fkey (
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

  const booking = data as unknown as Booking;

  if (booking.owner_id !== user.id) {
    redirect(`/dashboard/bookings/${booking.id}`);
  }

  const isService = booking.offers?.offer_type === "service";
  const showCalculatedTotalPrice =
    isService && booking.offers?.price_unit === "hour";

  const categoryLabel = booking.offers?.category
    ? isService
      ? serviceCategoryLabels[booking.offers.category] || booking.offers.category
      : categoryLabels[booking.offers.category] || booking.offers.category
    : "—";

  return (
    <main className="min-h-screen bg-[#efebdd] print:bg-white">
      <div className="mx-auto max-w-[980px] px-4 py-8 print:hidden">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <BackLink href={`/dashboard/bookings/${booking.id}`}>Zpět na rezervaci</BackLink>

          <div className="flex items-center gap-2">
            <HelpTopic
              triggerLabel="Jak protokol použít"
              title="Jak použít protokol"
              items={[
                { title: "Vyplňte ho při předání", description: "Zapište skutečný stav věci, viditelné vady, příslušenství a případně převzatou kauci." },
                { title: "Pořiďte fotografie", description: "Fotky stavu při předání pomáhají oběma stranám při pozdějším řešení poškození nebo sporu." },
                { title: "Podepište oba výtisky", description: "Každá strana by měla mít jednu podepsanou kopii nebo vlastní fotografii vyplněného protokolu." },
                { title: "Protokol nenahrazuje domluvu", description: "Konkrétní podmínky rezervace a komunikaci si vždy potvrďte také v chatu rezervace." },
              ]}
            />
            <PrintButton />
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-[794px] bg-white p-8 text-[9px] leading-tight text-black shadow-sm print:m-0 print:max-w-none print:p-0 print:text-[8.5px] print:shadow-none">
        <header className="mb-6 flex items-start justify-between border-b border-black pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em]">Koluj</p>
            <h1 className="mt-2 text-2xl font-black">{isService ? "Protokol o provedení služby" : "Protokol o předání"}</h1>
            <p className="mt-2 max-w-[560px] text-[11px] leading-relaxed">
              {isService
                ? "Tento protokol potvrzuje provedení služby mezi poskytovatelem a zákazníkem. Zákazník podpisem potvrzuje provedení služby nebo zakázky v dohodnutém rozsahu."
                : "Tento protokol potvrzuje fyzické předání předmětu rezervace mezi vlastníkem a rezervujícím. Rezervující podpisem potvrzuje převzetí nabídky, její stav při předání a odpovědnost za její vrácení."}
            </p>
          </div>

          <div className="text-right text-[10px]">
            <p className="font-bold">ID rezervace</p>
            <p>{booking.id}</p>
          </div>
        </header>

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-black uppercase">1. Identifikace rezervace</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <p><strong>ID rezervace:</strong> {booking.id}</p>
            <p><strong>Název nabídky:</strong> {valueOrLine(booking.offers?.title)}</p>
            <p><strong>Kategorie:</strong> {categoryLabel}</p>
            <p>
              <strong>Celková cena:</strong>{" "}
              {showCalculatedTotalPrice && booking.total_price !== null
                ? `${booking.total_price} Kč`
                : "_______________________"}
            </p>
            {!isService && <p><strong>Kauce:</strong> {booking.offers?.deposit || 0} Kč</p>}
            <p><strong>{isService ? "Lokalita působení" : "Místo předání"}:</strong> {valueOrLine(booking.offers?.pickup_place)}</p>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-8">
          <div>
            <h2 className="mb-2 text-sm font-black uppercase">{isService ? "2. Poskytovatel" : "2. Vlastník"}</h2>
            <div className="space-y-1">
              <p><strong>Jméno:</strong> _______________________</p>
              <p><strong>Telefon:</strong> {valueOrLine(booking.owner?.phone)}</p>
              <p><strong>E-mail:</strong> {valueOrLine(booking.owner?.email)}</p>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-black uppercase">{isService ? "3. Zákazník" : "3. Rezervující"}</h2>
            <div className="space-y-1">
              <p><strong>Jméno:</strong> _______________________</p>
              <p><strong>Telefon:</strong> {valueOrLine(booking.customer?.phone)}</p>
              <p><strong>E-mail:</strong> {valueOrLine(booking.customer?.email)}</p>
            </div>
          </div>
        </section>

        {!isService && (
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-black uppercase">4. Ověření totožnosti</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <Checkbox label="Totožnost ověřena dle občanského průkazu" />
              <Checkbox label="Totožnost nebyla ověřena" />
              <p><strong>Číslo OP / poslední 4 znaky:</strong> _______________________</p>
              <p><strong>Platnost dokladu do:</strong> _______________________</p>
            </div>
          </section>
        )}

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-black uppercase">{isService ? "4. Provedení služby" : "5. Stav nabídky při předání"}</h2>
          <p className="mb-2">
            {isService
              ? "Zákazník potvrzuje, že služba byla provedena v dohodnutém rozsahu uvedeném níže. "
              : "Rezervující potvrzuje, že si nabídku při převzetí prohlédl a přebírá ji ve stavu uvedeném níže."}
          </p>
          <WriteBox label={isService ? "Rozsah provedené služby:" : "Stav nabídky při předání:"} height="h-20" />
          <div className="mt-2">
            {!isService && <WriteBox label="Viditelné vady / opotřebení:" height="h-16" />}
          </div>
        </section>

        {isService ? (
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-black uppercase">5. Platba / cena</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <Checkbox label="Cena uhrazena v hotovosti" />
              <Checkbox label="Cena uhrazena převodem" />
              <Checkbox label="Cena bude uhrazena později dle dohody" />
              <p><strong>Uhrazena částka:</strong> _______________________ Kč</p>
            </div>
          </section>
        ) : (
          <section className="mb-5 grid grid-cols-2 gap-8">
            <div>
              <h2 className="mb-2 text-sm font-black uppercase">6. Fotodokumentace</h2>
              <div className="space-y-2">
                <Checkbox label="Fotografie byly pořízeny" />
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
        )}

        <section className="mb-5">
          <h2 className="mb-2 text-sm font-black uppercase">{isService ? "6. Prohlášení" : "8. Prohlášení"}</h2>
          <p className="leading-relaxed">
            {isService
              ? "Potvrzuji, že služba byla provedena v dohodnutém rozsahu, případné výhrady jsou uvedeny v poznámkách tohoto protokolu."
              : "Potvrzuji, že jsem převzal/a uvedenou nabídku ve stavu popsaném v tomto protokolu. Byl/a jsem seznámen/a s jejím používáním a zavazuji se ji vrátit ve sjednaném termínu. Beru na vědomí odpovědnost za škodu způsobenou ztrátou, odcizením nebo poškozením nad rámec běžného opotřebení."}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-sm font-black uppercase">{isService ? "7. Poznámky" : "9. Poznámky"}</h2>
          <WriteBox label="Další ujednání / poznámky:" height="h-16" />
        </section>

        <section className="mt-6 grid grid-cols-2 gap-14 text-xs">
          <div>
            <div className="border-t border-black pt-3">{isService ? "Podpis poskytovatele" : "Podpis vlastníka"}</div>
          </div>
          <div>
            <div className="border-t border-black pt-3">{isService ? "Podpis zákazníka" : "Podpis rezervujícího"}</div>
          </div>
        </section>

        <footer className="mt-5 border-t border-black pt-2 text-[8px] leading-tight">
          {isService
            ? "Tento protokol byl vytvořen prostřednictvím platformy Koluj a potvrzuje provedení služby mezi oběma stranami."
            : "Tento protokol byl vytvořen prostřednictvím platformy Koluj a potvrzuje fyzické předání předmětu rezervace mezi oběma stranami."}
        </footer>
      </article>
    </main>
  );
}
