import type { TripEditInput } from "./schema";

/**
 * Kolom `trips` yang boleh diubah lewat edit. Daftar eksplisit: UPDATE hanya
 * boleh memuat kolom-kolom ini. `updated_at` diperbarui oleh trigger database.
 * Tanpa `server-only` supaya bisa diuji; berisi nama kolom saja.
 */
export const EDITABLE_COLUMNS = [
  "destination",
  "title",
  "creator_name",
  "contact_type",
  "contact_value",
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
] as const;

/**
 * Kolom yang TIDAK PERNAH diubah edit. Dipakai di uji sebagai pagar:
 * `is_full` hanya diubah endpoint status (/api/trips/status), bukan edit; `card_snapshot` dan `theme` membuat kartu tidak
 * ikut berubah; sisanya identitas dan data rahasia.
 */
export const NON_EDITABLE_COLUMNS = [
  "id",
  "type",
  "edit_token_hash",
  "creator_ip_hash",
  "device_id",
  "card_snapshot",
  "theme",
  "is_full",
  "created_at",
  "updated_at",
] as const;

/**
 * Kolom yang dibaca untuk mengisi halaman edit (kontak ikut: hanya untuk
 * pemegang token). `is_full` hanya dibaca, untuk bagian "Status trip"; ia
 * tidak ada di EDITABLE_COLUMNS.
 */
export const EDIT_READ_COLUMNS = ["id", "type", ...EDITABLE_COLUMNS, "is_full"] as const;

export const EDIT_READ_SELECT = EDIT_READ_COLUMNS.join(", ");

/** Baris trip untuk halaman edit. Tanggal `date` berbentuk YYYY-MM-DD (teks). */
export type EditableTripRow = {
  id: string;
  type: "rencana" | "niat";
  destination: string;
  title: string;
  creator_name: string;
  contact_type: "whatsapp" | "instagram";
  contact_value: string;
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
  is_full: boolean;
};

/** Isi UPDATE dari hasil validasi: hanya kolom di EDITABLE_COLUMNS. */
export function buildEditPatch(trip: TripEditInput): Record<(typeof EDITABLE_COLUMNS)[number], unknown> {
  return {
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
  };
}
