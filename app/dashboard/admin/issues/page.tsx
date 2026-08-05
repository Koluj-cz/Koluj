import { redirect } from "next/navigation";
import BackLink from "@/app/components/BackLink";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";
import { getBookingIssueAttachmentUrl } from "@/lib/services/bookingIssueService";
import type {
  BookingIssueStatus,
  BookingIssueType,
} from "@/lib/services/bookingIssueShared";
import IssueAdminList, { type AdminIssueRow } from "./IssueAdminList";

export const dynamic = "force-dynamic";

export default async function AdminIssuesPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  const supabase = createSupabaseAdminClient();
  const { data: issues, error } = await supabase
    .from("booking_issues")
    .select("id,booking_id,reporter_id,issue_type,description,status,attachment_path,attachment_name,created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  const bookingIds = [...new Set((issues || []).map((issue) => issue.booking_id))];
  const reporterIds = [...new Set((issues || []).map((issue) => issue.reporter_id))];

  const [{ data: bookings }, { data: reporters }] = await Promise.all([
    bookingIds.length
      ? supabase.from("bookings").select("id,owner_id,customer_id,offer_id").in("id", bookingIds)
      : Promise.resolve({ data: [] }),
    reporterIds.length
      ? supabase.from("profiles").select("id,full_name,email").in("id", reporterIds)
      : Promise.resolve({ data: [] }),
  ]);

  const allProfileIds = [...new Set((bookings || []).flatMap((booking) => [booking.owner_id, booking.customer_id]).filter(Boolean))];
  const offerIds = [...new Set((bookings || []).map((booking) => booking.offer_id).filter(Boolean))];

  const [{ data: profiles }, { data: offers }] = await Promise.all([
    allProfileIds.length
      ? supabase.from("profiles").select("id,full_name,email").in("id", allProfileIds)
      : Promise.resolve({ data: [] }),
    offerIds.length
      ? supabase.from("offers").select("id,title").in("id", offerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const bookingMap = new Map((bookings || []).map((booking) => [booking.id, booking]));
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const reporterMap = new Map((reporters || []).map((profile) => [profile.id, profile]));
  const offerMap = new Map((offers || []).map((offer) => [offer.id, offer]));

  const rows: AdminIssueRow[] = await Promise.all((issues || []).map(async (issue) => {
    const booking = bookingMap.get(issue.booking_id);
    const reporter = reporterMap.get(issue.reporter_id);
    const owner = booking?.owner_id ? profileMap.get(booking.owner_id) : null;
    const customer = booking?.customer_id ? profileMap.get(booking.customer_id) : null;
    const offer = booking?.offer_id ? offerMap.get(booking.offer_id) : null;

    return {
      id: issue.id,
      bookingId: issue.booking_id,
      issueType: issue.issue_type as BookingIssueType,
      description: issue.description,
      status: issue.status as BookingIssueStatus,
      createdAt: issue.created_at,
      reporterName: reporter?.full_name || "Uživatel",
      reporterEmail: reporter?.email || null,
      ownerName: owner?.full_name || "Neuveden",
      customerName: customer?.full_name || "Neuveden",
      offerTitle: offer?.title || "Nabídka",
      attachmentName: issue.attachment_name || null,
      attachmentUrl: await getBookingIssueAttachmentUrl(issue.attachment_path || null),
    };
  }));

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8">
          <BackLink href="/dashboard">Dashboard</BackLink>
          <h1 className="koluj-heading mt-7">Nahlášené problémy</h1>
          <p className="mt-3 max-w-3xl text-[var(--koluj-muted)] md:text-lg">
            Přehled problémů nahlášených u rezervací. Otevři rezervaci, zkontroluj domluvu a změň stav podle toho, jak se případu věnuješ.
          </p>
        </section>
        <IssueAdminList initialIssues={rows} />
      </div>
    </main>
  );
}
