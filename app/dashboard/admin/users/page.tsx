import { redirect } from "next/navigation";
import BackLink from "@/app/components/BackLink";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";
import { calculateUserTrust } from "@/lib/services/userTrustService";
import UserAdminTable from "./UserAdminTable";

export const dynamic = "force-dynamic";

function isCurrentlyBanned(bannedUntil: string | undefined): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

export default async function AdminUsersPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  const supabase = createSupabaseAdminClient();
  const [
    { data: authData, error: authError },
    profilesResult,
    offersResult,
    bookingsResult,
    ratingsResult,
  ] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("profiles").select("id,full_name,phone,created_at"),
    supabase.from("offers").select("owner_id").is("deleted_at", null),
    supabase.from("bookings").select("owner_id,customer_id,status"),
    supabase.from("profile_ratings").select("profile_id,rating_avg,rating_count"),
  ]);

  if (authError) throw authError;

  const profiles = new Map(
    (profilesResult.data ?? []).map((row) => [row.id, row]),
  );
  const ratings = new Map(
    (ratingsResult.data ?? []).map((row) => [row.profile_id, row]),
  );
  const offerCounts = new Map<string, number>();
  const bookingCounts = new Map<string, number>();
  const completedAsProvider = new Map<string, number>();

  for (const row of offersResult.data ?? []) {
    offerCounts.set(row.owner_id, (offerCounts.get(row.owner_id) || 0) + 1);
  }

  for (const row of bookingsResult.data ?? []) {
    for (const id of new Set([row.owner_id, row.customer_id].filter(Boolean))) {
      bookingCounts.set(id, (bookingCounts.get(id) || 0) + 1);
    }
    if (row.status === "returned") {
      completedAsProvider.set(
        row.owner_id,
        (completedAsProvider.get(row.owner_id) || 0) + 1,
      );
    }
  }

  const users = authData.users.map((user) => {
    const profile = profiles.get(user.id);
    const rating = ratings.get(user.id);
    const banned = isCurrentlyBanned(user.banned_until);
    const trust = calculateUserTrust({
      emailVerified: Boolean(user.email_confirmed_at),
      phoneProvided: Boolean(profile?.phone?.trim()),
      completedBookings: completedAsProvider.get(user.id) || 0,
      ratingAverage: Number(rating?.rating_avg || 0),
      ratingCount: Number(rating?.rating_count || 0),
      joinedAt: profile?.created_at || user.created_at,
      banned,
    });

    return {
      id: user.id,
      email: user.email || "Bez e-mailu",
      name: profile?.full_name || String(user.user_metadata?.full_name || ""),
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at || null,
      banned,
      offers: offerCounts.get(user.id) || 0,
      bookings: bookingCounts.get(user.id) || 0,
      completedBookings: completedAsProvider.get(user.id) || 0,
      trust,
    };
  });

  return (
    <main className="koluj-home min-h-screen text-[var(--koluj-text)]">
      <div className="koluj-wide-frame relative z-10">
        <section className="koluj-hero-card p-5 md:p-8">
          <BackLink href="/dashboard">Dashboard</BackLink>
          <h1 className="koluj-heading mt-7">Správa uživatelů</h1>
          <p className="mt-3 text-[var(--koluj-muted)] md:text-lg">
            Přehled účtů, aktivity, důvěryhodnosti a možnost zablokovat nebo odblokovat přihlášení.
          </p>
        </section>
        <UserAdminTable initialUsers={users} />
      </div>
    </main>
  );
}
