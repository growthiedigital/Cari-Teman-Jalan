import type { PublicTrip } from "./public-columns";

const MONTHS_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

type Ymd = { y: number; m: number; d: number };

/** Urai "YYYY-MM-DD" dari teks, tanpa Date: tidak ada pergeseran zona waktu. */
function parseYmd(value: string): Ymd {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

const monthName = (m: number) => MONTHS_SHORT_ID[m - 1];

/**
 * Rentang tanggal jenis rencana:
 * "12 Des 2026", "12-15 Des 2026", "28 Nov - 2 Des 2026", "28 Des 2026 - 2 Jan 2027".
 */
export function formatDateRange(start: string, end: string): string {
  const a = parseYmd(start);
  const b = parseYmd(end);
  if (a.y === b.y && a.m === b.m) {
    if (a.d === b.d) return `${a.d} ${monthName(a.m)} ${a.y}`;
    return `${a.d}-${b.d} ${monthName(a.m)} ${a.y}`;
  }
  if (a.y === b.y) {
    return `${a.d} ${monthName(a.m)} - ${b.d} ${monthName(b.m)} ${b.y}`;
  }
  return `${a.d} ${monthName(a.m)} ${a.y} - ${b.d} ${monthName(b.m)} ${b.y}`;
}

/** Bulan jenis niat: "Perkiraan Des 2026" atau "Des 2026 - Feb 2027". */
export function formatMonthRange(start: string, end: string | null): string {
  const a = parseYmd(start);
  const first = `${monthName(a.m)} ${a.y}`;
  if (!end) return `Perkiraan ${first}`;
  const b = parseYmd(end);
  if (a.y === b.y && a.m === b.m) return `Perkiraan ${first}`;
  return `${first} - ${monthName(b.m)} ${b.y}`;
}

export function formatTripTime(
  trip: Pick<
    PublicTrip,
    "type" | "start_date" | "end_date" | "month_start" | "month_end"
  >,
): string | null {
  if (trip.type === "rencana") {
    if (!trip.start_date || !trip.end_date) return null;
    return formatDateRange(trip.start_date, trip.end_date);
  }
  if (!trip.month_start) return null;
  return formatMonthRange(trip.month_start, trip.month_end);
}

/** 2500000 -> "Rp 2.500.000 / orang" */
export function formatBudgetPerPerson(value: number): string {
  return `Rp ${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} / orang`;
}
