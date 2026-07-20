"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
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
  eyebrow = "Nápověda",
  compact = false,
  className = "",
}: HelpTopicProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

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
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100dvh-24px)] w-full overflow-y-auto rounded-t-[32px] bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[85vh] sm:max-w-xl sm:rounded-[32px] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--koluj-green)]">
              {eyebrow}
            </p>
            <h2 id={titleId} className="mt-1 text-2xl font-black">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-text)] transition hover:text-[var(--koluj-green)]"
            aria-label="Zavřít nápovědu"
          >
            <X size={21} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-[var(--koluj-border)] bg-[var(--koluj-bg)] p-4"
            >
              <div className="flex items-start gap-3">
                {item.icon ? (
                  <span className="mt-0.5 shrink-0 text-[var(--koluj-green)]">
                    {item.icon}
                  </span>
                ) : null}
                <div>
                  <p className="font-black text-[var(--koluj-text)]">{item.title}</p>
                  <p className="mt-1 text-sm font-bold leading-relaxed text-[var(--koluj-muted)]">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
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
            : "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-black text-[var(--koluj-green)] transition hover:bg-[var(--koluj-bg)]"
        } ${className}`}
        aria-label={compact ? triggerLabel : undefined}
      >
        <Info size={compact ? 18 : 16} />
        {!compact ? triggerLabel : null}
      </button>

      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
