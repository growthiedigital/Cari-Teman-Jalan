import { NextResponse } from "next/server";

import { recordEventAfter } from "@/lib/analytics/record-event";
import { buildCardSnapshot } from "@/lib/card/snapshot";
import { getSupabaseServer } from "@/lib/supabase/server";
import { checkTripLimit, TRIP_LIMIT_MESSAGE } from "@/lib/trip/rate-limit";
import { validateTrip, type TripInput } from "@/lib/trip/schema";
import {
  generateEditToken,
  generateTripId,
  getKnownClientIp,
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
    theme: trip.theme,
    // Salinan field yang tampil di kartu; sengaja tanpa kontak dan tanpa token.
    card_snapshot: buildCardSnapshot(trip),
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
    // IP tidak diketahui: tetap disimpan sebagai hash "unknown" (seperti
    // sebelumnya), tetapi TIDAK dipakai untuk menghitung batas.
    const clientIp = getKnownClientIp(request.headers);
    const creatorIpHash = hashIp(clientIp ?? "unknown");

    const limit = await checkTripLimit(supabase, {
      ipHash: clientIp ? creatorIpHash : null,
      deviceId: result.data.deviceId,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { message: TRIP_LIMIT_MESSAGE },
        {
          status: 429,
          headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const editToken = generateEditToken();
    const editTokenHash = sha256Hex(editToken);

    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
      const id = generateTripId();
      const { error } = await supabase
        .from("trips")
        .insert(buildRow(result.data, id, editTokenHash, creatorIpHash));

      if (!error) {
        // Hanya setelah insert berhasil; penolakan (400/429) tidak dicatat.
        recordEventAfter({ event: "trip_created", tripType: result.data.type, tripId: id });
        return json({ id, editToken }, 201);
      }
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
