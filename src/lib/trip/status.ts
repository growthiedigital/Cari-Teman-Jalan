import { todayJakarta } from "./dates";

/**
 * Status trip: satu-satunya tempat aturan "Sudah lewat" / "Sudah penuh" dan
 * "boleh dihubungi atau tidak" (halaman detail, /go/[id], halaman edit).
 * Murni dan tanpa `server-only`: hanya menghitung, tidak membaca database.
 * Dihitung saat dirender/diminta; tanpa cron dan tanpa kolom tambahan.
 */

export type ExpiryInput = {
  type: string;
  /** YYYY-MM-DD, atau null (jenis niat tidak punya tanggal pulang). */
  end_date: string | null;
};

export type StatusInput = ExpiryInput & { is_full: boolean };

export type TripStatus = {
  isFull: boolean;
  isExpired: boolean;
  canContact: boolean;
};

/**
 * Trip "Sudah lewat": hanya jenis `rencana` dengan `end_date` yang sudah
 * lewat, dibandingkan sebagai teks YYYY-MM-DD dengan HARI INI menurut Asia/
 * Jakarta (bukan UTC, bukan zona server). Pada tanggal pulang itu sendiri
 * trip belum lewat; baru lewat mulai 00:00 WIB hari berikutnya. Jenis `niat`
 * tidak pernah lewat.
 */
export function isExpired(trip: ExpiryInput, now: Date = new Date()): boolean {
  if (trip.type !== "rencana" || !trip.end_date) return false;
  return trip.end_date < todayJakarta(now);
}

export function tripStatus(trip: StatusInput, now: Date = new Date()): TripStatus {
  const isFull = trip.is_full === true;
  const expired = isExpired(trip, now);
  return { isFull, isExpired: expired, canContact: !isFull && !expired };
}

/** Label tombol Hubungi yang dinonaktifkan; kedaluwarsa didahulukan. */
export function disabledContactLabel(status: TripStatus): string {
  return status.isExpired ? "Trip ini sudah lewat" : "Trip ini sudah penuh";
}
