// Helper localStorage untuk klien. Semua akses dibungkus try/catch karena
// localStorage bisa tidak tersedia (mode privat, diblokir).

const DEVICE_KEY = "tripcard:deviceId";
const MY_TRIPS_KEY = "tripcard:mytrips";

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

/** Tambahkan trip baru ke daftar "trip saya" (UI-nya dibuat di tahap berikutnya). */
export function saveMyTrip(trip: MyTrip): void {
  try {
    let list: unknown = [];
    try {
      list = JSON.parse(localStorage.getItem(MY_TRIPS_KEY) ?? "[]");
    } catch {
      list = [];
    }
    const trips = Array.isArray(list) ? list : [];
    trips.push(trip);
    localStorage.setItem(MY_TRIPS_KEY, JSON.stringify(trips));
  } catch {
    // Penyimpanan tidak tersedia; trip tetap sudah tersimpan di server.
  }
}
