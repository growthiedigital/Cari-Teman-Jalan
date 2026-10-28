// Daftar event analytics. Sama dengan check pada tabel `events` (schema.sql).
// Tanpa `server-only` supaya bisa dipakai juga di komponen klien.

export const EVENT_NAMES = [
  "form_opened",
  "trip_created",
  "card_downloaded",
  "link_copied",
  "detail_viewed",
  "contact_clicked",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** Event yang boleh dikirim klien lewat POST /api/events. Sisanya hanya dicatat server. */
export const CLIENT_EVENT_NAMES = ["form_opened", "detail_viewed", "link_copied"] as const;

export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

export const EVENT_TRIP_TYPES = ["rencana", "niat"] as const;

export type EventTripType = (typeof EVENT_TRIP_TYPES)[number];

export function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && (EVENT_NAMES as readonly string[]).includes(value);
}

export function isClientEventName(value: unknown): value is ClientEventName {
  return typeof value === "string" && (CLIENT_EVENT_NAMES as readonly string[]).includes(value);
}

export function isEventTripType(value: unknown): value is EventTripType {
  return typeof value === "string" && (EVENT_TRIP_TYPES as readonly string[]).includes(value);
}
