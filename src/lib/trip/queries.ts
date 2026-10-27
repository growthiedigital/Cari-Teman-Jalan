import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";

import { isValidTripId } from "./id";
import {
  CONTACT_SELECT,
  PUBLIC_TRIP_SELECT,
  type PublicTrip,
} from "./public-columns";

/**
 * Trip untuk halaman publik, atau null bila id tidak valid / trip tidak ada.
 * ID tidak valid tidak menyentuh database. Error database dilempar (bukan
 * dianggap "tidak ditemukan"); isi pesannya tidak boleh sampai ke pengguna.
 */
export async function getPublicTrip(id: string): Promise<PublicTrip | null> {
  if (!isValidTripId(id)) return null;
  const { data, error } = await getSupabaseServer()
    .from("trips")
    .select(PUBLIC_TRIP_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[getPublicTrip] query gagal", { code: error.code });
    throw new Error("Gagal memuat trip.");
  }
  return (data as PublicTrip | null) ?? null;
}

/** Kontak trip (hanya untuk /go/[id]). Aturan id dan error sama dengan di atas. */
export async function getTripContact(
  id: string,
): Promise<{ contactType: string; contactValue: string } | null> {
  if (!isValidTripId(id)) return null;
  const { data, error } = await getSupabaseServer()
    .from("trips")
    .select(CONTACT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[getTripContact] query gagal", { code: error.code });
    throw new Error("Gagal memuat kontak trip.");
  }
  if (!data) return null;
  const row = data as unknown as { contact_type: string; contact_value: string };
  return { contactType: row.contact_type, contactValue: row.contact_value };
}
