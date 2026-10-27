import { NextResponse } from "next/server";

import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Reason =
  | "env_kosong"
  | "tabel_tidak_ada"
  | "akses_ditolak"
  | "key_tidak_valid"
  | "koneksi_gagal"
  | "query_gagal";

// Kode kasar untuk diagnosis; sengaja tidak membawa pesan error atau data.
function classify(error: { code?: string; message?: string; status?: number }): Reason {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "PGRST205" || code === "42P01") return "tabel_tidak_ada";
  if (code === "42501") return "akses_ditolak";
  if (code.startsWith("PGRST3") || message.includes("jwt") || message.includes("api key") || error.status === 401) {
    return "key_tidak_valid";
  }
  if (message.includes("fetch failed") || message.includes("network") || error.status === 0) {
    return "koneksi_gagal";
  }
  return "query_gagal";
}

export async function GET() {
  let reason: Reason | undefined;

  let client;
  try {
    client = getSupabaseServer();
  } catch {
    reason = "env_kosong";
  }

  if (client) {
    try {
      const { error } = await client.from("trips").select("id").limit(1);
      if (error) reason = classify(error);
    } catch {
      reason = "koneksi_gagal";
    }
  }

  const db = reason === undefined;
  return NextResponse.json(
    db ? { ok: true, db: true } : { ok: false, db: false, reason },
    { status: db ? 200 : 503 },
  );
}
