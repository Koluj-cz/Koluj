"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center justify-center gap-2 rounded-[24px] bg-[var(--koluj-green)] px-5 py-3 font-black text-white shadow-sm hover:shadow-md"
    >
      <Printer size={18} />
      Tisknout
    </button>
  );
}
