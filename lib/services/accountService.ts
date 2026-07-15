import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function deactivateAccountServer({
  userId,
}: {
  userId: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();
  const deactivatedAt = new Date().toISOString();

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      is_deactivated: true,
      deactivated_at: deactivatedAt,
      email_notifications_enabled: false,
      marketing_notifications_enabled: false,
    })
    .eq("id", userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  // Nabídky pouze dočasně skryjeme kvůli účtu. Jejich vlastní stav
  // active/inactive/archived neměníme, aby šel po obnově přesně zachovat.
  const { error: offersError } = await supabaseAdmin
    .from("offers")
    .update({ hidden_by_account_deactivation: true })
    .eq("owner_id", userId)
    .neq("publication_status", "archived")
    .eq("hidden_by_account_deactivation", false);

  if (offersError) {
    throw new Error(offersError.message);
  }

  const { error: pushError } = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);

  if (pushError) {
    throw new Error(pushError.message);
  }

  return {
    ok: true,
    deactivatedAt,
  };
}

export async function restoreAccountServer({
  userId,
}: {
  userId: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: profile, error: profileLoadError } = await supabaseAdmin
    .from("profiles")
    .select("id, is_deactivated")
    .eq("id", userId)
    .maybeSingle();

  if (profileLoadError) {
    throw new Error(profileLoadError.message);
  }

  if (!profile || !profile.is_deactivated) {
    return {
      ok: true,
      restored: false,
    };
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      is_deactivated: false,
      deactivated_at: null,
    })
    .eq("id", userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  // Obnovíme jen dočasné skrytí účtem. Publikační stav nabídky zůstává
  // přesně takový, jaký byl před deaktivací účtu.
  const { error: offersError } = await supabaseAdmin
    .from("offers")
    .update({ hidden_by_account_deactivation: false })
    .eq("owner_id", userId)
    .eq("hidden_by_account_deactivation", true);

  if (offersError) {
    throw new Error(offersError.message);
  }

  return {
    ok: true,
    restored: true,
  };
}
