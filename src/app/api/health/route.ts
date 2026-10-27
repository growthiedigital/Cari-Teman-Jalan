import { NextResponse } from "next/server";

import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    const { error } = await getSupabaseServer()
      .from("trips")
      .select("id")
      .limit(1);
    db = !error;
  } catch {
    // env kosong atau DB tidak terjangkau; detail error sengaja tidak dibocorkan
    db = false;
  }

  return NextResponse.json({ ok: db, db }, { status: db ? 200 : 503 });
}
