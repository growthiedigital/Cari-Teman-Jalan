const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Hari ini (YYYY-MM-DD) menurut zona Asia/Jakarta, apa pun zona perangkat/server. */
export function todayJakarta(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Bulan berjalan (YYYY-MM-01) menurut Asia/Jakarta. */
export function currentMonthJakarta(now: Date = new Date()): string {
  return `${todayJakarta(now).slice(0, 7)}-01`;
}

/** True bila string persis YYYY-MM-DD dan merupakan tanggal kalender yang ada. */
export function isValidDateString(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

/** Daftar bulan (nilai YYYY-MM-01) mulai bulan berjalan, sebanyak `count`. */
export function upcomingMonths(
  now: Date = new Date(),
  count = 36,
): { value: string; label: string }[] {
  const [y, m] = todayJakarta(now).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const index = m - 1 + i;
    const year = y + Math.floor(index / 12);
    const month = (index % 12) + 1;
    return {
      value: `${year}-${String(month).padStart(2, "0")}-01`,
      label: `${MONTHS_ID[month - 1]} ${year}`,
    };
  });
}

/** "2026-12-25" -> "25 Desember 2026" */
export function formatDateId(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

/** "2026-12-01" -> "Desember 2026" */
export function formatMonthId(value: string): string {
  const [y, m] = value.split("-").map(Number);
  return `${MONTHS_ID[m - 1]} ${y}`;
}

/** 1500000 -> "Rp1.500.000" */
export function formatRupiah(value: number): string {
  return `Rp${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/**
 * Gabungkan pilihan bulan dengan bulan yang sudah tersimpan (mode edit), supaya
 * bulan lama yang sudah lewat tetap muncul dan terpilih. Hasil terurut.
 */
export function withStoredMonths(
  options: { value: string; label: string }[],
  stored: (string | null)[],
): { value: string; label: string }[] {
  const byValue = new Map(options.map((o) => [o.value, o]));
  for (const value of stored) {
    if (value && !byValue.has(value)) {
      byValue.set(value, { value, label: formatMonthId(value) });
    }
  }
  return [...byValue.values()].sort((a, b) => a.value.localeCompare(b.value));
}
