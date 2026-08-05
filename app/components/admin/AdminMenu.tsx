"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  FileBarChart,
  SearchCheck,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

const items = [
  { href: "/dashboard/moderation", label: "Moderace", description: "Kontrola médií", icon: ShieldCheck },
  { href: "/dashboard/admin/issues", label: "Nahlášené problémy", description: "Problémy u rezervací", icon: AlertTriangle, issueCount: true },
  { href: "/dashboard/admin/users", label: "Uživatelé", description: "Účty a bany", icon: Users },
  { href: "/dashboard/admin/reports", label: "Měsíční reporty", description: "Historie a statistiky", icon: FileBarChart },
  { href: "/dashboard/admin/search-intents", label: "Chytré vyhledávání", description: "Záměry a doporučení", icon: SearchCheck },
] as const;

export default function AdminMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [newIssues, setNewIssues] = useState(0);
  const titleId = useId();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    fetch("/api/admin/issues/count", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => setNewIssues(Number(result?.count || 0)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu = open ? (
    <div
      className="fixed inset-0 z-[1400] bg-black/15 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-3 right-3 max-h-[calc(100dvh-110px-env(safe-area-inset-bottom))] overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-2xl sm:bottom-auto sm:left-auto sm:right-6 sm:top-24 sm:w-[390px]"
      >
        <header className="flex items-center justify-between border-b border-[var(--koluj-border)] px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-600">Koluj.cz</p>
            <h2 id={titleId} className="mt-1 text-xl font-black">Administrace</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--koluj-bg)]" aria-label="Zavřít administraci">
            <X size={18} />
          </button>
        </header>
        <nav className="max-h-[calc(100dvh-210px)] overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = item.icon;
            const count = "issueCount" in item && item.issueCount ? newIssues : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={() => setOpen(false)}
                className="flex items-center gap-4 rounded-2xl p-3 transition hover:bg-violet-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Icon size={21} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-black">
                    {item.label}
                    {count > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{count}</span>}
                  </span>
                  <span className="mt-0.5 block text-sm font-bold text-[var(--koluj-muted)]">{item.description}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-[var(--koluj-muted)]" />
              </Link>
            );
          })}
        </nav>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 font-black text-white shadow-sm hover:bg-violet-700"
      >
        <Settings size={18} />
        <span className="hidden sm:inline">Administrace</span>
        {newIssues > 0 && <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs text-white ring-2 ring-white">{newIssues}</span>}
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
