import type { TripType } from "./constants";

/**
 * Kolom `trips` yang boleh dibaca untuk halaman detail publik /trip/[id].
 * Daftar eksplisit (tanpa `select *`) supaya kontak, hash token, hash IP,
 * device id, dan snapshot kartu tidak pernah ikut terbaca di halaman ini.
 * Tanpa `server-only` supaya bisa diuji; berisi nama kolom saja.
 */
export const PUBLIC_TRIP_COLUMNS = [
  "id",
  "type",
  "title",
  "destination",
  "tags",
  "buddies_wanted",
  "note",
  "budget",
  "itinerary",
  "start_date",
  "end_date",
  "month_start",
  "month_end",
  "intention",
  "creator_name",
  "is_full",
] as const;

export const PUBLIC_TRIP_SELECT = PUBLIC_TRIP_COLUMNS.join(", ");

/** Kolom kontak: hanya dibaca oleh route /go/[id]. */
export const CONTACT_COLUMNS = ["contact_type", "contact_value"] as const;

/**
 * Kolom yang dibaca /go/[id]: kontak plus kolom status (`is_full`, `type`,
 * `end_date`) supaya server bisa menolak trip penuh/lewat.
 */
export const CONTACT_SELECT = [
  ...CONTACT_COLUMNS,
  "is_full",
  "type",
  "end_date",
].join(", ");

/** Baris trip untuk halaman publik. Tanggal `date` berbentuk YYYY-MM-DD (teks). */
export type PublicTrip = {
  id: string;
  type: TripType;
  title: string;
  destination: string;
  tags: string[];
  buddies_wanted: number | null;
  note: string | null;
  budget: number | null;
  itinerary: string | null;
  start_date: string | null;
  end_date: string | null;
  month_start: string | null;
  month_end: string | null;
  intention: string | null;
  creator_name: string;
  is_full: boolean;
};
