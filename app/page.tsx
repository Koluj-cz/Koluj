export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f8f5] text-black">

      <nav className="flex items-center justify-between px-8 py-6">
        <h1 className="text-2xl font-bold tracking-tight">
          KOLUJ
        </h1>

        <button className="rounded-full border border-black px-5 py-2 text-sm transition hover:bg-black hover:text-white">
          Přihlásit se
        </button>
      </nav>

      <section className="flex flex-col items-center justify-center px-6 py-24 text-center">

        <p className="mb-4 rounded-full bg-black px-4 py-1 text-sm text-white">
          Testovací verze
        </p>

        <h1 className="max-w-4xl text-6xl font-bold leading-tight tracking-tight md:text-8xl">
          Věci mají kolovat.
        </h1>

        <p className="mt-8 max-w-2xl text-xl text-gray-600">
          Půjčuj si věci od lidí ve svém okolí místo jejich kupování.
        </p>

        <div className="mt-12 flex gap-4">
          <button className="rounded-2xl bg-black px-8 py-4 text-white transition hover:opacity-90">
            Začít
          </button>

          <button className="rounded-2xl border border-gray-300 bg-white px-8 py-4 transition hover:bg-gray-100">
            Jak to funguje
          </button>
        </div>

      </section>

    </main>
  );
}