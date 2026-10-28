import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Batas pembuatan trip per perangkat/IP dalam satu jendela. */
export const MAX_TRIPS_PER_WINDOW = 5;
/** Jendela bergulir 24 jam (bukan hari kalender). */
export const TRIP_WINDOW_MS = 24 * 60 * 60 * 1000;

export const TRIP_LIMIT_MESSAGE = `Kamu sudah membuat ${MAX_TRIPS_PER_WINDOW} trip dalam 24 jam terakhir. Coba lagi nanti.`;

export type TripLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type TripLimitKeys = {
  /** Hash IP; null bila IP tidak diketahui (IP tidak dihitung sama sekali). */
  ipHash: string | null;
  deviceId: string;
};

/**
 * Waktu (ms epoch) kapan hitungan satu kunci turun di bawah batas, atau null
 * bila kunci itu belum mencapai batas. Mengambil MAX baris terbaru dalam
 * jendela: bila ada MAX baris, baris ke-MAX terbaru adalah yang harus keluar
 * dari jendela supaya satu slot kosong (sama dengan baris terlama yang
 * terhitung bila hitungannya tepat MAX).
 */
async function freeSlotAt(
  supabase: SupabaseClient,
  column: "creator_ip_hash" | "device_id",
  value: string,
  sinceIso: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("trips")
    .select("created_at")
    .eq(column, value)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(MAX_TRIPS_PER_WINDOW);
  if (error) {
    console.error("[trip-limit] query gagal", { code: error.code });
    throw new Error("Gagal memeriksa batas trip.");
  }
  const rows = (data ?? []) as { created_at: string }[];
  if (rows.length < MAX_TRIPS_PER_WINDOW) return null;
  return new Date(rows[MAX_TRIPS_PER_WINDOW - 1].created_at).getTime() + TRIP_WINDOW_MS;
}

/**
 * Periksa batas pembuatan trip: hitung baris `trips` dalam 24 jam terakhir
 * dengan `creator_ip_hash` yang sama ATAU `device_id` yang sama. Bila salah
 * satu >= MAX_TRIPS_PER_WINDOW, ditolak. IP yang tidak diketahui tidak
 * dihitung (supaya pengguna tanpa IP tidak berbagi satu keranjang).
 * Melempar bila database error; pemanggil memutuskan responsnya.
 */
export async function checkTripLimit(
  supabase: SupabaseClient,
  keys: TripLimitKeys,
  now: number = Date.now(),
): Promise<TripLimitResult> {
  const sinceIso = new Date(now - TRIP_WINDOW_MS).toISOString();
  const checks: Promise<number | null>[] = [
    freeSlotAt(supabase, "device_id", keys.deviceId, sinceIso),
  ];
  if (keys.ipHash) checks.push(freeSlotAt(supabase, "creator_ip_hash", keys.ipHash, sinceIso));

  const freeAt = (await Promise.all(checks)).filter((t): t is number => t !== null);
  if (freeAt.length === 0) return { allowed: true };
  // Bila dua kunci sama-sama penuh, baru boleh lagi setelah keduanya longgar.
  const retryAfterSeconds = Math.max(1, Math.ceil((Math.max(...freeAt) - now) / 1000));
  return { allowed: false, retryAfterSeconds };
}
