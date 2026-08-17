"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--koluj-border)] bg-white px-3 py-0 text-sm font-black text-[var(--koluj-green)] shadow-sm transition hover:bg-[var(--koluj-bg)] sm:w-auto sm:px-4"
    >
      <Printer size={17} />
      Tisknout
    </button>
  );
}
