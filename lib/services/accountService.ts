import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function deactivateAccountServer({
  userId,
}: {
  userId: string;
}) {
  const deactivatedAt = new Date().toISOString();

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      is_deactivated: true,
      deactivated_at: deactivatedAt,
      full_name: "Deaktivovaný účet",
      phone: null,
      bio: null,
      avatar_url: null,
      email_notifications_enabled: false,
      marketing_notifications_enabled: false,
    })
    .eq("id", userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: itemsError } = await supabaseAdmin
    .from("items")
    .update({
      is_active: false,
      deleted_at: deactivatedAt,
    })
    .eq("owner_id", userId)
    .is("deleted_at", null);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);

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

  const { error: itemsError } = await supabaseAdmin
    .from("items")
    .update({
      deleted_at: null,
      is_active: true,
    })
    .eq("owner_id", userId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return {
    ok: true,
    restored: true,
  };
}
