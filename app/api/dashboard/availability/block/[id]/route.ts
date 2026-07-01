import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, { params }: RouteProps) {
  const { id } = await params;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: block, error: blockError } = await supabaseAdmin
    .from("offer_availability_blocks")
    .select("id, owner_id")
    .eq("id", id)
    .single();

  if (blockError || !block) {
    return NextResponse.json(
      { error: "Blokace nebyla nalezena." },
      { status: 404 }
    );
  }

  if (block.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Tuto blokaci může zrušit pouze vlastník." },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("offer_availability_blocks")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
