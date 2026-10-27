import { NextResponse } from "next/server";

import { getSupabaseServer } from "@/lib/supabase/server";
import { validateTrip, type TripInput } from "@/lib/trip/schema";
import {
  generateEditToken,
  generateTripId,
  getClientIp,
  hashIp,
  sha256Hex,
} from "@/lib/trip/secrets";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 20_000;
const MAX_ID_ATTEMPTS = 5;
const GENERIC_ERROR = "Terjadi kesalahan di server. Coba lagi beberapa saat lagi.";
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function buildRow(
  trip: TripInput,
  id: string,
  editTokenHash: string,
  creatorIpHash: string,
) {
  const theme = "a";
  return {
    id,
    edit_token_hash: editTokenHash,
    type: trip.type,
    destination: trip.destination,
    title: trip.title,
    creator_name: trip.creatorName,
    contact_type: trip.contactType,
    contact_value: trip.contactValue,
    tags: trip.tags,
    buddies_wanted: trip.buddiesWanted,
    note: trip.note,
    budget: trip.budget,
    itinerary: trip.itinerary,
    start_date: trip.startDate,
    end_date: trip.endDate,
    month_start: trip.monthStart,
    month_end: trip.monthEnd,
    intention: trip.intention,
    theme,
    // Salinan field yang tampil di kartu; sengaja tanpa kontak dan tanpa token.
    card_snapshot: {
      type: trip.type,
      title: trip.title,
      destination: trip.destination,
      tags: trip.tags,
      buddies_wanted: trip.buddiesWanted,
      start_date: trip.startDate,
      end_date: trip.endDate,
      month_start: trip.monthStart,
      month_end: trip.monthEnd,
      theme,
    },
    creator_ip_hash: creatorIpHash,
    device_id: trip.deviceId,
  };
}

export async function POST(request: Request) {
  // 1. Baca dan validasi input. Bagian ini tidak menyentuh database.
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

  const result = validateTrip(body);
  if (!result.ok) {
    return json(
      { message: "Beberapa isian belum benar. Periksa kembali.", errors: result.errors },
      400,
    );
  }

  // 2. Simpan. Pesan error internal tidak pernah dikirim ke klien, dan log
  //    hanya memuat kode kasar (tanpa kontak, token, atau isi baris).
  try {
    const supabase = getSupabaseServer();
    const creatorIpHash = hashIp(getClientIp(request.headers));
    const editToken = generateEditToken();
    const editTokenHash = sha256Hex(editToken);

    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
      const id = generateTripId();
      const { error } = await supabase
        .from("trips")
        .insert(buildRow(result.data, id, editTokenHash, creatorIpHash));

      if (!error) return json({ id, editToken }, 201);
      if (error.code !== "23505") {
        console.error("[POST /api/trips] insert gagal", { code: error.code });
        return json({ message: GENERIC_ERROR }, 500);
      }
      // 23505 = ID bentrok; coba lagi dengan ID baru.
    }
    console.error("[POST /api/trips] ID bentrok berulang kali");
    return json({ message: GENERIC_ERROR }, 500);
  } catch {
    console.error("[POST /api/trips] gagal menyimpan (konfigurasi atau koneksi)");
    return json({ message: GENERIC_ERROR }, 500);
  }
}
