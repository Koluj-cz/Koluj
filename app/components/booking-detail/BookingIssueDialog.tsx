"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Paperclip, X } from "lucide-react";
import toast from "react-hot-toast";

const ISSUE_OPTIONS = [
  ["provider_no_show", "Poskytovatel nepřišel"],
  ["customer_no_show", "Zájemce nepřišel"],
  ["damaged_item", "Věc byla poškozena"],
  ["not_returned", "Věc nebyla vrácena"],
  ["not_as_described", "Nabídka neodpovídala popisu"],
  ["inappropriate_behavior", "Nevhodné chování"],
  ["other", "Jiný problém"],
] as const;

export default function BookingIssueDialog({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !sending) setOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, sending]);

  function closeDialog() {
    if (sending) return;
    setOpen(false);
  }

  async function submitIssue() {
    if (!issueType) {
      toast.error("Vyber typ problému");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Popiš problém alespoň 10 znaky");
      return;
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("issueType", issueType);
      formData.append("description", description.trim());
      if (attachment) formData.append("attachment", attachment);

      const response = await fetch(`/api/bookings/${bookingId}/issues`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Problém se nepodařilo odeslat");

      toast.success("Problém byl odeslán správci Koluj");
      setIssueType("");
      setDescription("");
      setAttachment(null);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Problém se nepodařilo odeslat");
    } finally {
      setSending(false);
    }
  }

  const dialog = open ? (
    <div
      className="fixed inset-0 z-[1400] bg-black/20 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-3 right-3 flex max-h-[calc(100dvh-110px-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-[28px] border border-[var(--koluj-border)] bg-white shadow-2xl sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(560px,calc(100vw-48px))] sm:-translate-x-1/2 sm:-translate-y-1/2"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--koluj-border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-xl font-black">Nahlásit problém</h2>
            <p className="mt-1 text-sm font-bold text-[var(--koluj-muted)]">
              Hlášení se uloží k rezervaci a odešle správci Koluj.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDialog}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--koluj-bg)] text-[var(--koluj-muted)]"
            aria-label="Zavřít"
          >
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          <label className="block text-sm font-black">Co se stalo?</label>
          <select
            value={issueType}
            onChange={(event) => setIssueType(event.target.value)}
            className="koluj-select mt-2 w-full font-bold"
          >
            <option value="">Vyber typ problému</option>
            {ISSUE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label className="mt-5 block text-sm font-black">Popis problému</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 2000))}
            placeholder="Stručně popiš, co se stalo a kdy..."
            className="koluj-input mt-2 min-h-32 w-full"
          />
          <p className="mt-1 text-right text-xs font-bold text-[var(--koluj-muted)]">
            {description.length}/2000
          </p>

          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[var(--koluj-border)] px-4 py-3 font-black text-[var(--koluj-green)] hover:bg-[var(--koluj-green-pale)]">
            <Paperclip size={18} />
            <span className="min-w-0 truncate">{attachment?.name || "Přiložit soubor (nepovinné)"}</span>
            <input
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.zip"
              onChange={(event) => setAttachment(event.target.files?.[0] || null)}
            />
          </label>
          <p className="mt-2 text-xs font-bold text-[var(--koluj-muted)]">Maximálně 15 MB.</p>
        </div>

        <footer className="grid shrink-0 gap-3 border-t border-[var(--koluj-border)] bg-white p-5 sm:grid-cols-2">
          <button type="button" onClick={closeDialog} disabled={sending} className="h-12 rounded-2xl border border-[var(--koluj-border)] font-black disabled:opacity-50">
            Zrušit
          </button>
          <button type="button" onClick={() => void submitIssue()} disabled={sending} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 font-black text-white disabled:opacity-50">
            <AlertTriangle size={18} />
            {sending ? "Odesílám..." : "Odeslat hlášení"}
          </button>
        </footer>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 font-black text-red-600 hover:bg-red-50"
      >
        <AlertTriangle size={18} />
        Nahlásit problém
      </button>
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
