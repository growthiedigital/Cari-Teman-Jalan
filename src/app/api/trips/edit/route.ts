import { NextResponse } from "next/server";

import { findTripByToken, updateTripByToken } from "@/lib/trip/edit-queries";
import { isValidEditToken } from "@/lib/trip/edit-link";
import { validateTripEdit, type StoredTripTiming } from "@/lib/trip/schema";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 20_000;
const GENERIC_ERROR = "Terjadi kesalahan di server. Coba lagi beberapa saat lagi.";
const NOT_FOUND = "Link edit tidak valid atau trip sudah dihapus.";
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Simpan perubahan trip. Token ada di body (bukan URL/query). Urutan: token
 * dikenal? (404 generik bila tidak) -> validasi dengan skema edit (400 per
 * field) -> UPDATE hanya kolom yang boleh diedit. Respons tidak memuat hash
 * token, hash IP, maupun device id, dan token tidak pernah masuk log.
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
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ message: "Data yang dikirim tidak valid." }, 400);
  }

  const { token, ...fields } = body as Record<string, unknown>;
  if (!isValidEditToken(token)) return json({ message: NOT_FOUND }, 404);

  try {
    const row = await findTripByToken(token);
    if (!row) return json({ message: NOT_FOUND }, 404);

    const stored: StoredTripTiming = {
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      monthStart: row.month_start,
      monthEnd: row.month_end,
    };
    const result = validateTripEdit(fields, stored);
    if (!result.ok) {
      return json(
        { message: "Beberapa isian belum benar. Periksa kembali.", errors: result.errors },
        400,
      );
    }

    const updated = await updateTripByToken(token, result.data);
    if (!updated) return json({ message: NOT_FOUND }, 404);
    return json({ id: updated.id, title: updated.title }, 200);
  } catch {
    console.error("[POST /api/trips/edit] gagal menyimpan (konfigurasi atau koneksi)");
    return json({ message: GENERIC_ERROR }, 500);
  }
}
