import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { restoreAccountServer } from "@/lib/services/accountService";

export async function POST() {
  const { user } = await requireUser();


  try {
    const result = await restoreAccountServer({
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Účet se nepodařilo obnovit" },
      { status: 400 }
    );
  }
}
