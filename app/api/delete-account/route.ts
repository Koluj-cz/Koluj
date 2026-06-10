import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const userId = user.id;

    await supabaseAdmin
      .from("notifications")
      .delete()
      .or(`user_id.eq.${userId},actor_id.eq.${userId}`);

    await supabaseAdmin
      .from("loan_messages")
      .delete()
      .eq("sender_id", userId);

    await supabaseAdmin
      .from("loan_participant_presence")
      .delete()
      .eq("user_id", userId);

    await supabaseAdmin
      .from("reviews")
      .delete()
      .or(`reviewer_id.eq.${userId},reviewed_user_id.eq.${userId}`);

    await supabaseAdmin
      .from("items")
      .update({
        is_active: false,
      })
      .eq("owner_id", userId);

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: "Smazaný uživatel",
        city: null,
        latitude: null,
        longitude: null,
        avatar_url: null,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", userId);

    const { error: banError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
        user_metadata: {
          deleted: true,
          deleted_at: new Date().toISOString(),
        },
      });

    if (banError) {
      return NextResponse.json(
        { error: banError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Účet se nepodařilo smazat" },
      { status: 500 }
    );
  }
}