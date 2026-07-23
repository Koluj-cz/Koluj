import { redirect } from "next/navigation";
import BackLink from "@/app/components/BackLink";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";
import UserAdminTable from "./UserAdminTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }
  const supabase = createSupabaseAdminClient();
  const [{ data: authData, error: authError }, profilesResult, offersResult, bookingsResult] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("profiles").select("id,full_name"),
    supabase.from("offers").select("owner_id").is("deleted_at", null),
    supabase.from("bookings").select("owner_id,customer_id,status"),
  ]);
  if (authError) throw authError;
  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.id, row.full_name || ""]));
  const offerCounts = new Map<string, number>();
  for (const row of offersResult.data ?? []) offerCounts.set(row.owner_id, (offerCounts.get(row.owner_id) || 0) + 1);
  const bookingCounts = new Map<string, number>(); const completed = new Map<string, number>();
  for (const row of bookingsResult.data ?? []) {
    for (const id of new Set([row.owner_id, row.customer_id].filter(Boolean))) bookingCounts.set(id, (bookingCounts.get(id) || 0) + 1);
    if (row.status === "returned") for (const id of new Set([row.owner_id, row.customer_id].filter(Boolean))) completed.set(id, (completed.get(id) || 0) + 1);
  }
  const users = authData.users.map((user) => ({ id: user.id, email: user.email || "Bez e-mailu", name: profiles.get(user.id) || String(user.user_metadata?.full_name || ""), createdAt: user.created_at, lastSignInAt: user.last_sign_in_at || null, banned: Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now()), offers: offerCounts.get(user.id) || 0, bookings: bookingCounts.get(user.id) || 0, completedBookings: completed.get(user.id) || 0 }));
  return <main className="koluj-home min-h-screen text-[var(--koluj-text)]"><div className="koluj-wide-frame relative z-10"><section className="koluj-hero-card p-5 md:p-8"><BackLink href="/dashboard">Dashboard</BackLink><h1 className="koluj-heading mt-7">Správa uživatelů</h1><p className="mt-3 text-[var(--koluj-muted)] md:text-lg">Přehled účtů, jejich aktivity a možnost okamžitě zablokovat nebo odblokovat přihlášení.</p></section><UserAdminTable initialUsers={users} /></div></main>;
}
