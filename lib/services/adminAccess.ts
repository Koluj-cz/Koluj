import { requireUser } from "@/lib/supabase/server";

export function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS || "info@koluj.cz")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin() {
  const { user } = await requireUser();
  if (!user.email || !configuredAdminEmails().includes(user.email.toLowerCase())) {
    throw new Error("Unauthorized");
  }
  return user;
}
