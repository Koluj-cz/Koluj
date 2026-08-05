"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ExternalLink, Paperclip } from "lucide-react";
import {
  BOOKING_ISSUE_LABELS,
  BOOKING_ISSUE_STATUS_LABELS,
  type BookingIssueStatus,
  type BookingIssueType,
} from "@/lib/services/bookingIssueService";

export type AdminIssueRow = {
  id: string;
  bookingId: string;
  issueType: BookingIssueType;
  description: string;
  status: BookingIssueStatus;
  createdAt: string;
  reporterName: string;
  reporterEmail: string | null;
  ownerName: string;
  customerName: string;
  offerTitle: string;
  attachmentName: string | null;
  attachmentUrl: string | null;
};

const statusStyles: Record<BookingIssueStatus, string> = {
  new: "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-700",
};

export default function IssueAdminList({ initialIssues }: { initialIssues: AdminIssueRow[] }) {
  const [issues, setIssues] = useState(initialIssues);
  const [filter, setFilter] = useState<"all" | BookingIssueStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const filteredIssues = useMemo(
    () => filter === "all" ? issues : issues.filter((issue) => issue.status === filter),
    [filter, issues],
  );

  async function updateStatus(id: string, status: BookingIssueStatus) {
    setBusy(id);
    try {
      const response = await fetch(`/api/admin/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Stav se nepodařilo změnit");
      setIssues((current) => current.map((issue) => issue.id === id ? { ...issue, status } : issue));
      toast.success(`Stav změněn na „${BOOKING_ISSUE_STATUS_LABELS[status]}“`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Stav se nepodařilo změnit");
    } finally {
      setBusy(null);
    }
  }

  const counts = {
    all: issues.length,
    new: issues.filter((issue) => issue.status === "new").length,
    in_progress: issues.filter((issue) => issue.status === "in_progress").length,
    resolved: issues.filter((issue) => issue.status === "resolved").length,
  };

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        {([
          ["all", "Vše"],
          ["new", "Nové"],
          ["in_progress", "Řeší se"],
          ["resolved", "Vyřešené"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-black transition ${filter === value ? "bg-violet-600 text-white" : "bg-white text-[var(--koluj-muted)] shadow-sm"}`}
          >
            {label} ({counts[value]})
          </button>
        ))}
      </div>

      <section className="mt-4 grid gap-4">
        {filteredIssues.map((issue) => (
          <article key={issue.id} className="koluj-card p-5 md:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusStyles[issue.status]}`}>
                    {BOOKING_ISSUE_STATUS_LABELS[issue.status]}
                  </span>
                  <span className="text-xs font-bold text-[var(--koluj-muted)]">
                    {new Date(issue.createdAt).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}
                  </span>
                </div>

                <h2 className="mt-3 text-xl font-black">{BOOKING_ISSUE_LABELS[issue.issueType]}</h2>
                <p className="mt-1 font-bold text-[var(--koluj-muted)]">{issue.offerTitle}</p>
                <p className="mt-4 whitespace-pre-line leading-relaxed text-[var(--koluj-muted)]">{issue.description}</p>

                <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                  <p><strong>Nahlásil:</strong> {issue.reporterName}{issue.reporterEmail ? ` · ${issue.reporterEmail}` : ""}</p>
                  <p><strong>Vlastník:</strong> {issue.ownerName}</p>
                  <p><strong>Zájemce:</strong> {issue.customerName}</p>
                  <p className="break-all"><strong>ID:</strong> {issue.id}</p>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/dashboard/bookings/${issue.bookingId}`}
                    prefetch={false}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--koluj-green)] px-4 font-black text-white"
                  >
                    Otevřít rezervaci <ExternalLink size={16} />
                  </Link>
                  {issue.attachmentUrl && (
                    <a
                      href={issue.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--koluj-border)] px-4 font-black"
                    >
                      <Paperclip size={16} /> {issue.attachmentName || "Příloha"}
                    </a>
                  )}
                </div>
              </div>

              <div className="grid shrink-0 gap-2 sm:grid-cols-3 xl:w-44 xl:grid-cols-1">
                {(["new", "in_progress", "resolved"] as BookingIssueStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busy === issue.id || issue.status === status}
                    onClick={() => void updateStatus(issue.id, status)}
                    className={`h-11 rounded-2xl px-4 text-sm font-black disabled:cursor-default ${issue.status === status ? statusStyles[status] : "border border-[var(--koluj-border)] bg-white hover:bg-[var(--koluj-bg)]"}`}
                  >
                    {BOOKING_ISSUE_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}

        {!filteredIssues.length && (
          <div className="koluj-card p-10 text-center font-bold text-[var(--koluj-muted)]">
            V této kategorii nejsou žádné nahlášené problémy.
          </div>
        )}
      </section>
    </>
  );
}
