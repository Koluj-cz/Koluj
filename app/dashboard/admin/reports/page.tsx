import { redirect } from "next/navigation";
import BackLink from "@/app/components/BackLink";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";
import ReportActions from "./ReportActions";
import ReportHistory from "./ReportHistory";

export const dynamic = "force-dynamic";

const TABLES = ["offer_images", "offer_videos", "service_realization_images", "service_realization_videos"] as const;
const PRAGUE_TIME_ZONE = "Europe/Prague";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: PRAGUE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: PRAGUE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export default async function AdminReportsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  const supabase = createSupabaseAdminClient();
  const { data: reports, error: reportsError } = await supabase
    .from("admin_monthly_reports")
    .select("id,period_start,period_end,status,subject,sent_at,error_message,metrics,html")
    .order("period_start", { ascending: false })
    .limit(24);

  if (reportsError) throw reportsError;

  const moderation = { review: 0, rejected: 0, failed: 0, approved: 0, pending: 0 };
  for (const table of TABLES) {
    const { data } = await supabase.from(table).select("moderation_status");
    for (const row of data ?? []) {
      const key = String(row.moderation_status) as keyof typeof moderation;
      if (key in moderation) moderation[key]++;
    }
  }

  const reportRows = (reports ?? []).map((report) => ({
    id: report.id,
    subject: report.subject,
    periodStart: formatDate(report.period_start),
    periodEnd: formatDate(report.period_end),
    status: report.status,
    sentAt: report.sent_at ? formatDateTime(report.sent_at) : null,
    errorMessage: report.error_message,
    html: report.html,
  }));

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8">
          <BackLink href="/dashboard">Dashboard</BackLink>
          <div className="mt-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="koluj-heading">Měsíční reporty</h1>
              <p className="mt-3 text-[var(--koluj-muted)] md:text-lg">Historie manažerských reportů a aktuální stav moderace médií.</p>
            </div>
            <ReportActions />
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries({
            "Ke kontrole": moderation.review,
            Zamítnuté: moderation.rejected,
            Chyby: moderation.failed,
            Schválené: moderation.approved,
            Čekající: moderation.pending,
          }).map(([label, value]) => (
            <div className="koluj-card p-5" key={label}>
              <p className="text-sm font-black text-[var(--koluj-muted)]">{label}</p>
              <p className="mt-2 text-3xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <ReportHistory reports={reportRows} />
      </div>
    </main>
  );
}
