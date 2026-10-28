// Helper localStorage untuk klien. Semua akses dibungkus try/catch karena
// localStorage bisa tidak tersedia (mode privat, diblokir, data dibersihkan).
// Daftar "trip saya" memuat token edit (rahasia): jangan pernah dicatat ke
// log atau dikirim ke analytics.

const DEVICE_KEY = "tripcard:deviceId";
export const MY_TRIPS_KEY = "tripcard:mytrips";
// Cadangan di sessionStorage: salinan trip yang baru dibuat, dibaca /sukses
// bila localStorage gagal.
const BACKUP_KEY = "tripcard:lastcreated";

export type MyTrip = {
  id: string;
  editToken: string;
  title: string;
  createdAt: string;
};

let memoryDeviceId: string | null = null;

function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** UUID acak perangkat; dibuat sekali bila belum ada. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    memoryDeviceId ??= randomUuid();
    localStorage.setItem(DEVICE_KEY, memoryDeviceId);
    return memoryDeviceId;
  } catch {
    memoryDeviceId ??= randomUuid();
    return memoryDeviceId;
  }
}

/**
 * Urai isi mentah `tripcard:mytrips`. JSON rusak, bukan larik, atau entri yang
 * bentuknya salah -> dibuang (hasil kosong), tidak pernah melempar.
 */
export function parseMyTrips(raw: string | null | undefined): MyTrip[] {
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.filter(isMyTrip).map((t) => ({
    id: t.id,
    editToken: t.editToken,
    title: t.title,
    createdAt: t.createdAt,
  }));
}

function isMyTrip(value: unknown): value is MyTrip {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.editToken === "string" &&
    typeof t.title === "string" &&
    typeof t.createdAt === "string"
  );
}

/** Isi mentah daftar (untuk useSyncExternalStore); null bila kosong atau storage gagal. */
export function readMyTripsRaw(): string | null {
  try {
    return localStorage.getItem(MY_TRIPS_KEY);
  } catch {
    return null;
  }
}

/** Daftar "trip saya" di browser ini; kosong bila storage tidak tersedia. */
export function readMyTrips(): MyTrip[] {
  return parseMyTrips(readMyTripsRaw());
}

function writeMyTrips(trips: MyTrip[]): boolean {
  try {
    localStorage.setItem(MY_TRIPS_KEY, JSON.stringify(trips));
    return true;
  } catch {
    return false;
  }
}

/** Tambahkan trip baru (id yang sama diganti, bukan digandakan). */
export function saveMyTrip(trip: MyTrip): void {
  // Penyimpanan bisa tidak tersedia; trip tetap sudah tersimpan di server.
  writeMyTrips([...readMyTrips().filter((t) => t.id !== trip.id), trip]);
}

/** Buang satu trip dari daftar. Tidak melempar. */
export function removeMyTrip(id: string): void {
  const trips = readMyTrips();
  if (trips.some((t) => t.id === id)) writeMyTrips(trips.filter((t) => t.id !== id));
}

/** Buang entri yang punya token ini (halaman edit 404 tidak tahu id-nya). */
export function removeMyTripByToken(token: string): void {
  const trips = readMyTrips();
  if (trips.some((t) => t.editToken === token)) {
    writeMyTrips(trips.filter((t) => t.editToken !== token));
  }
}

/** Ada entri dengan token ini di daftar browser ini? */
export function hasMyTripWithToken(token: string): boolean {
  return readMyTrips().some((t) => t.editToken === token);
}

/** Ubah judul entri bila ada di daftar (setelah edit berhasil). */
export function updateMyTripTitle(id: string, title: string): void {
  const trips = readMyTrips();
  if (trips.some((t) => t.id === id)) {
    writeMyTrips(trips.map((t) => (t.id === id ? { ...t, title } : t)));
  }
}

/** Simpan cadangan di sessionStorage saat trip baru dibuat. */
export function saveSessionBackup(trip: Pick<MyTrip, "id" | "editToken">): void {
  try {
    sessionStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({ id: trip.id, editToken: trip.editToken }),
    );
  } catch {
    // Tidak tersedia; tidak ada yang bisa dilakukan.
  }
}

function readSessionBackupToken(id: string): string | null {
  try {
    const raw = sessionStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const b = value as Record<string, unknown>;
    return b.id === id && typeof b.editToken === "string" ? b.editToken : null;
  } catch {
    return null;
  }
}

/**
 * Token edit untuk trip ini: dari localStorage, atau (bila gagal) dari
 * cadangan sessionStorage. null bila keduanya tidak punya.
 */
export function findEditToken(id: string): string | null {
  return (
    readMyTrips().find((t) => t.id === id)?.editToken ?? readSessionBackupToken(id)
  );
}
