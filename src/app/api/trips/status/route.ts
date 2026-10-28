import { NextResponse } from "next/server";

import { isValidEditToken } from "@/lib/trip/edit-link";
import { setTripFullByToken } from "@/lib/trip/edit-queries";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 2_000;
const GENERIC_ERROR = "Terjadi kesalahan di server. Coba lagi beberapa saat lagi.";
const NOT_FOUND = "Link edit tidak valid atau trip sudah dihapus.";
const BAD_BODY = "Data yang dikirim tidak valid.";
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Tandai trip "Sudah penuh" (`isFull: true`) atau buka lagi (`false`). Token
 * ada di body (bukan URL/query). Hanya meng-UPDATE kolom `is_full`; endpoint
 * edit (/api/trips/edit) sengaja tidak menyentuh kolom itu. Token tidak
 * dikenal -> 404 generik; body tidak valid (termasuk `isFull` bukan boolean)
 * -> 400. Respons tidak memuat token, hash token, hash IP, maupun device id,
 * dan token tidak pernah masuk log.
 */
export async function POST(request: Request) {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return json({ message: BAD_BODY }, 400);
  }
  if (text.length > MAX_BODY_CHARS) {
    return json({ message: "Data yang dikirim terlalu besar." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ message: BAD_BODY }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ message: BAD_BODY }, 400);
  }

  const { token, isFull } = body as Record<string, unknown>;
  if (!isValidEditToken(token)) return json({ message: NOT_FOUND }, 404);
  // Boolean ketat: "true", 1, null, atau hilang ditolak.
  if (typeof isFull !== "boolean") return json({ message: BAD_BODY }, 400);

  try {
    const updated = await setTripFullByToken(token, isFull);
    if (!updated) return json({ message: NOT_FOUND }, 404);
    return json({ ok: true, isFull: updated.isFull }, 200);
  } catch {
    console.error("[POST /api/trips/status] gagal memperbarui (konfigurasi atau koneksi)");
    return json({ message: GENERIC_ERROR }, 500);
  }
}
