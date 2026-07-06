import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { deactivateAccountServer } from "@/lib/services/accountService";

export async function POST() {
  const { user } = await requireUser();


  try {
    const result = await deactivateAccountServer({
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Účet se nepodařilo deaktivovat" },
      { status: 400 }
    );
  }
}
