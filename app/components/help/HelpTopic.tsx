"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

export type HelpItem = {
  title: string;
  description: string;
  icon?: ReactNode;
};

type HelpTopicProps = {
  title: string;
  items: HelpItem[];
  triggerLabel?: string;
  eyebrow?: string;
  compact?: boolean;
  className?: string;
};

export default function HelpTopic({
  title,
  items,
  triggerLabel = "Nápověda",
  compact = false,
  className = "",
}: HelpTopicProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const dialog = open ? (
    <div
      className="fixed inset-0 z-[1200] bg-black/10 sm:bg-black/25 sm:backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-3 right-3 flex max-h-[min(620px,calc(100dvh-120px-env(safe-area-inset-bottom)))] flex-col overflow-hidden rounded-[28px] border border-[var(--koluj-border)] bg-white/98 shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(420px,calc(100vw-48px))] sm:-translate-x-1/2 sm:-translate-y-1/2"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--koluj-border)] px-5 py-4">
          <h2
            id={titleId}
            className="min-w-0 truncate text-xl font-black text-[var(--koluj-ink)]"
          >
            {title}
          </h2>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-muted)] transition hover:bg-[var(--koluj-green-pale)] hover:text-[var(--koluj-green)]"
            aria-label="Zavřít nápovědu"
          >
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto overscroll-contain px-5">
          <div className="divide-y divide-[var(--koluj-border)]">
            {items.map((item) => (
              <div key={item.title} className="py-4 first:pt-5 last:pb-5">
                <p className="font-black leading-snug text-[var(--koluj-ink)]">
                  {item.title}
                </p>
                <p className="mt-1.5 text-sm font-bold leading-relaxed text-[var(--koluj-muted)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${
          compact
            ? "flex h-9 w-9 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-green)]"
            : "inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-black text-[var(--koluj-green)] transition hover:bg-[var(--koluj-bg)]"
        } ${className}`}
        aria-label={compact ? triggerLabel : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Info size={compact ? 18 : 16} />
        {!compact ? triggerLabel : null}
      </button>

      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
