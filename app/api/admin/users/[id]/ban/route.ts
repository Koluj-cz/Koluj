import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/adminAccess";
import {
  deactivateAccountServer,
  restoreAccountServer,
} from "@/lib/services/accountService";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;

    if (id === admin.id) {
      return NextResponse.json(
        { error: "Vlastní účet nelze zablokovat." },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const banned = Boolean(body?.banned);
    const supabase = createSupabaseAdminClient();

    if (banned) {
      await deactivateAccountServer({ userId: id });

      const { data, error } = await supabase.auth.admin.updateUserById(id, {
        ban_duration: "876000h",
      });

      if (error) {
        await restoreAccountServer({ userId: id }).catch(() => undefined);
        throw error;
      }

      return NextResponse.json({ ok: true, banned: true, userId: data.user.id });
    }

    await restoreAccountServer({ userId: id });

    const { data, error } = await supabase.auth.admin.updateUserById(id, {
      ban_duration: "none",
    });

    if (error) {
      await deactivateAccountServer({ userId: id }).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ ok: true, banned: false, userId: data.user.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Akce selhala";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 },
    );
  }
}
