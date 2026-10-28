import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";

import {
  EDIT_READ_SELECT,
  buildEditPatch,
  type EditableTripRow,
} from "./edit-columns";
import { isValidEditToken } from "./edit-link";
import type { TripEditInput } from "./schema";
import { hashEditToken } from "./secrets";

/*
 * Akses trip lewat token edit. Token dihitung hash SHA-256-nya lalu dicocokkan
 * dengan `edit_token_hash`; token mentah tidak pernah dikirim ke database,
 * dicatat di log, atau dimasukkan ke pesan error. Error database dilempar
 * tanpa isi (hanya kode kasar di log) dan tidak dianggap "tidak ditemukan".
 *
 * Token yang bentuknya tidak valid -> null tanpa menyentuh database.
 */

/** Baris trip untuk form edit, atau null bila token tidak valid / tidak dikenal. */
export async function findTripByToken(token: unknown): Promise<EditableTripRow | null> {
  if (!isValidEditToken(token)) return null;
  const { data, error } = await getSupabaseServer()
    .from("trips")
    .select(EDIT_READ_SELECT)
    .eq("edit_token_hash", hashEditToken(token))
    .maybeSingle();
  if (error) {
    console.error("[findTripByToken] query gagal", { code: error.code });
    throw new Error("Gagal memuat trip.");
  }
  return (data as unknown as EditableTripRow | null) ?? null;
}

/**
 * UPDATE kolom yang boleh diedit saja (lihat EDITABLE_COLUMNS). Mengembalikan
 * { id, title } baris yang diubah, atau null bila tidak ada baris yang cocok
 * (mis. trip baru saja dihapus).
 */
export async function updateTripByToken(
  token: string,
  trip: TripEditInput,
): Promise<{ id: string; title: string } | null> {
  const { data, error } = await getSupabaseServer()
    .from("trips")
    .update(buildEditPatch(trip))
    .eq("edit_token_hash", hashEditToken(token))
    .select("id, title")
    .maybeSingle();
  if (error) {
    console.error("[updateTripByToken] update gagal", { code: error.code });
    throw new Error("Gagal menyimpan trip.");
  }
  return (data as unknown as { id: string; title: string } | null) ?? null;
}

/** Hapus permanen baris trip. True bila ada baris yang terhapus. Baris `events` tidak disentuh. */
export async function deleteTripByToken(token: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer()
    .from("trips")
    .delete()
    .eq("edit_token_hash", hashEditToken(token))
    .select("id");
  if (error) {
    console.error("[deleteTripByToken] hapus gagal", { code: error.code });
    throw new Error("Gagal menghapus trip.");
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * UPDATE HANYA kolom `is_full` (tandai penuh / buka lagi). Mengembalikan nilai
 * `is_full` yang tersimpan, atau null bila tidak ada baris yang cocok (token
 * tidak dikenal atau trip sudah dihapus).
 */
export async function setTripFullByToken(
  token: string,
  isFull: boolean,
): Promise<{ isFull: boolean } | null> {
  const { data, error } = await getSupabaseServer()
    .from("trips")
    .update({ is_full: isFull })
    .eq("edit_token_hash", hashEditToken(token))
    .select("is_full")
    .maybeSingle();
  if (error) {
    console.error("[setTripFullByToken] update gagal", { code: error.code });
    throw new Error("Gagal memperbarui status trip.");
  }
  if (!data) return null;
  return { isFull: (data as unknown as { is_full: boolean }).is_full };
}
