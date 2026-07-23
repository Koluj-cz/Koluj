"use client";

import { useState } from "react";
import { Eye, X } from "lucide-react";

type ReportRow = {
  id: string;
  subject: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  sentAt: string | null;
  errorMessage: string | null;
  html: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  sent: "Odesláno",
  failed: "Chyba",
  processing: "Zpracovává se",
  pending: "Čeká",
};

function statusClass(status: string) {
  if (status === "sent") return "bg-green-100 text-green-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

export default function ReportHistory({ reports }: { reports: ReportRow[] }) {
  const [selected, setSelected] = useState<ReportRow | null>(null);

  return (
    <>
      <section className="koluj-card mt-6 overflow-hidden">
        <div className="divide-y divide-black/5">
          {reports.map((report) => (
            <article key={report.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-black">{report.subject}</p>
                <p className="mt-1 text-sm text-[var(--koluj-muted)]">
                  {report.periodStart} – {report.periodEnd}
                </p>
                {report.errorMessage && <p className="mt-2 text-sm font-bold text-red-600">{report.errorMessage}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(report.status)}`}>
                  {STATUS_LABELS[report.status] ?? report.status}
                </span>
                {report.sentAt && <span className="text-xs text-[var(--koluj-muted)]">{report.sentAt}</span>}
                {report.html && (
                  <button
                    type="button"
                    onClick={() => setSelected(report)}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-700"
                  >
                    <Eye size={16} /> Zobrazit report
                  </button>
                )}
              </div>
            </article>
          ))}
          {!reports.length && <p className="p-10 text-center text-[var(--koluj-muted)]">Zatím nebyl vytvořen žádný report.</p>}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 md:p-6" role="dialog" aria-modal="true" aria-label="Náhled měsíčního reportu">
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3 md:px-6">
              <div className="min-w-0">
                <p className="truncate font-black">{selected.subject}</p>
                <p className="text-xs text-[var(--koluj-muted)]">{selected.periodStart} – {selected.periodEnd}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl p-2 transition hover:bg-black/5" aria-label="Zavřít náhled">
                <X size={22} />
              </button>
            </div>
            <iframe
              title={selected.subject}
              srcDoc={selected.html ?? ""}
              sandbox=""
              className="min-h-0 flex-1 bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}
