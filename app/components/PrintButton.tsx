"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--koluj-border)] bg-white px-4 py-3 font-black text-[var(--koluj-green)] shadow-sm transition hover:bg-[var(--koluj-bg)]"
    >
      <Printer size={17} />
      Tisknout
    </button>
  );
}
