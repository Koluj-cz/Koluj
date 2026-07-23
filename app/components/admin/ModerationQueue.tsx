"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import BackLink from "@/app/components/BackLink";

export type ModerationRow = {
  id: string;
  table: string;
  url: string | null;
  status: "review" | "rejected" | "failed";
  reason: string | null;
  created_at: string;
};

type Filter = "attention" | "review" | "failed" | "rejected";

const statusMeta = {
  review: {
    label: "Ke kontrole",
    description: "Automatická kontrola si není jistá. Médium je skryté, dokud ho ručně neschválíš nebo nezamítneš.",
    icon: AlertTriangle,
    className: "bg-amber-100 text-amber-900",
  },
  failed: {
    label: "Technická chyba",
    description: "Kontrola neproběhla. U fotografií nejde o zamítnutí; výsledek je potřeba ručně rozhodnout.",
    icon: RotateCcw,
    className: "bg-slate-100 text-slate-800",
  },
  rejected: {
    label: "Zamítnuto",
    description: "Médium je skryté na veřejném webu, ale zůstává uložené a lze ho znovu schválit.",
    icon: XCircle,
    className: "bg-red-100 text-red-800",
  },
} as const;

const mediaLabels: Record<string, string> = {
  offer_images: "Fotografie nabídky",
  offer_videos: "Video nabídky",
  service_realization_images: "Fotografie realizace",
  service_realization_videos: "Video realizace",
};

export default function ModerationQueue({ initialRows }: { initialRows: ModerationRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<Filter>("attention");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      attention: rows.filter((row) => row.status === "review" || row.status === "failed").length,
      review: rows.filter((row) => row.status === "review").length,
      failed: rows.filter((row) => row.status === "failed").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
    }),
    [rows],
  );

  const visibleRows = rows.filter((row) =>
    filter === "attention"
      ? row.status === "review" || row.status === "failed"
      : row.status === filter,
  );

  async function update(row: ModerationRow, status: "approved" | "rejected") {
    const key = `${row.table}-${row.id}`;
    setBusyKey(key);

    try {
      const response = await fetch(`/api/admin/moderation/${row.table}/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Akce selhala");

      setRows((current) =>
        status === "approved"
          ? current.filter((item) => !(item.id === row.id && item.table === row.table))
          : current.map((item) =>
              item.id === row.id && item.table === row.table
                ? {
                    ...item,
                    status: "rejected",
                    reason: "Zamítnuto administrátorem",
                  }
                : item,
            ),
      );
      toast.success(status === "approved" ? "Médium bylo schváleno" : "Médium bylo zamítnuto a skryto");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Akce selhala");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8">
          <BackLink href="/dashboard">Dashboard</BackLink>
          <div className="mt-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 className="koluj-heading">Moderace médií</h1>
              <p className="mt-3 max-w-3xl text-[var(--koluj-muted)] md:text-lg">
                Kontroluj nejisté výsledky, technické chyby a dříve zamítnutá média. Zamítnuté položky se nemažou, pouze se skryjí.
              </p>
            </div>
            <Link href="/dashboard" className="koluj-link shrink-0">Zpět na přehled</Link>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {(Object.keys(statusMeta) as Array<keyof typeof statusMeta>).map((status) => {
            const meta = statusMeta[status];
            const Icon = meta.icon;
            return (
              <div key={status} className="koluj-card p-5">
                <div className="flex items-center gap-3">
                  <span className={`rounded-xl p-2 ${meta.className}`}><Icon size={20} /></span>
                  <div>
                    <p className="font-black">{meta.label}</p>
                    <p className="text-sm text-[var(--koluj-muted)]">{counts[status]} položek</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--koluj-muted)]">{meta.description}</p>
              </div>
            );
          })}
        </section>

        <section className="koluj-card mt-6 overflow-hidden">
          <div className="flex flex-wrap gap-2 border-b border-black/5 p-4">
            <FilterButton active={filter === "attention"} onClick={() => setFilter("attention")}>Vyžaduje rozhodnutí ({counts.attention})</FilterButton>
            <FilterButton active={filter === "review"} onClick={() => setFilter("review")}>Ke kontrole ({counts.review})</FilterButton>
            <FilterButton active={filter === "failed"} onClick={() => setFilter("failed")}>Chyby ({counts.failed})</FilterButton>
            <FilterButton active={filter === "rejected"} onClick={() => setFilter("rejected")}>Zamítnuté ({counts.rejected})</FilterButton>
          </div>

          {visibleRows.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="mx-auto text-[var(--koluj-green)]" size={34} />
              <p className="mt-3 font-black">Tady je vše vyřešené.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {visibleRows.map((row) => {
                const key = `${row.table}-${row.id}`;
                const meta = statusMeta[row.status];
                return (
                  <article key={key} className="grid gap-4 p-4 md:grid-cols-[180px_1fr_auto] md:items-center md:p-5">
                    {row.url ? (
                      <img src={row.url} alt="Náhled média" className="h-36 w-full rounded-2xl object-cover md:h-28" />
                    ) : (
                      <div className="h-36 w-full rounded-2xl bg-gray-100 md:h-28" />
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{mediaLabels[row.table] || row.table}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${meta.className}`}>{meta.label}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--koluj-muted)]">{row.reason || "Bez uvedeného důvodu"}</p>
                      <p className="mt-2 text-xs font-bold text-[var(--koluj-muted)]">{new Date(row.created_at).toLocaleString("cs-CZ")}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button
                        disabled={busyKey === key}
                        onClick={() => void update(row, "approved")}
                        className="rounded-xl bg-[var(--koluj-green)] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                      >
                        {row.status === "rejected" ? "Obnovit a schválit" : "Schválit"}
                      </button>
                      {row.status !== "rejected" && (
                        <button
                          disabled={busyKey === key}
                          onClick={() => void update(row, "rejected")}
                          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                        >
                          Zamítnout
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-black transition ${active ? "bg-[var(--koluj-green)] text-white" : "bg-black/5 text-[var(--koluj-muted)] hover:bg-black/10"}`}
    >
      {children}
    </button>
  );
}
