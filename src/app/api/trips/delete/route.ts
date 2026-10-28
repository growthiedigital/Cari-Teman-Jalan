import { NextResponse } from "next/server";

import { isValidEditToken } from "@/lib/trip/edit-link";
import { deleteTripByToken } from "@/lib/trip/edit-queries";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 2_000;
const GENERIC_ERROR = "Terjadi kesalahan di server. Coba lagi beberapa saat lagi.";
const NOT_FOUND = "Link edit tidak valid atau trip sudah dihapus.";
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Hapus permanen trip (hard delete) dari token di body. Baris `events` sengaja
 * tidak disentuh (tanpa foreign key). Token tidak dikenal -> 404 generik.
 */
export async function POST(request: Request) {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return json({ message: "Data yang dikirim tidak valid." }, 400);
  }
  if (text.length > MAX_BODY_CHARS) {
    return json({ message: "Data yang dikirim terlalu besar." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ message: "Data yang dikirim tidak valid." }, 400);
  }
  const token =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).token
      : undefined;
  if (!isValidEditToken(token)) return json({ message: NOT_FOUND }, 404);

  try {
    const deleted = await deleteTripByToken(token);
    if (!deleted) return json({ message: NOT_FOUND }, 404);
    return json({ ok: true }, 200);
  } catch {
    console.error("[POST /api/trips/delete] gagal menghapus (konfigurasi atau koneksi)");
    return json({ message: GENERIC_ERROR }, 500);
  }
}
