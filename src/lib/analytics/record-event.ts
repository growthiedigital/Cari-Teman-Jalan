import "server-only";

import { after } from "next/server";

import { getSupabaseServer } from "@/lib/supabase/server";

import { isEventName, isEventTripType, type EventName, type EventTripType } from "./events";

export type RecordEventInput = {
  event: EventName;
  tripType?: EventTripType | null;
  tripId?: string | null;
};

/**
 * Catat satu baris di `events`: hanya event, trip_type, trip_id, dan waktu
 * (diisi database). TIDAK PERNAH melempar error: kegagalan analytics tidak
 * boleh mengganggu pembuatan trip, redirect, atau unduhan. Log hanya memuat
 * kode kasar.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    if (!isEventName(input.event)) return;
    const tripType = isEventTripType(input.tripType) ? input.tripType : null;
    const tripId = typeof input.tripId === "string" && input.tripId ? input.tripId : null;
    const { error } = await getSupabaseServer()
      .from("events")
      .insert({ event: input.event, trip_type: tripType, trip_id: tripId });
    if (error) console.error("[recordEvent] insert gagal", { code: error.code });
  } catch {
    console.error("[recordEvent] gagal mencatat event");
  }
}

/**
 * Seperti `recordEvent`, tetapi dijalankan SETELAH respons terkirim (`after`
 * dari next/server, Next.js >= 15) supaya tidak menunda respons. Di luar
 * lingkup permintaan (mis. uji unit) `after` melempar; saat itu pencatatan
 * dijalankan langsung tanpa ditunggu. Tidak pernah melempar.
 */
export function recordEventAfter(input: RecordEventInput): void {
  try {
    after(() => recordEvent(input));
  } catch {
    void recordEvent(input);
  }
}
