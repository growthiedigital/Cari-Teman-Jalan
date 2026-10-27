/** ID trip: persis 10 karakter base62 (lihat generateTripId di secrets.ts). */
const TRIP_ID_PATTERN = /^[0-9A-Za-z]{10}$/;

export function isValidTripId(value: unknown): value is string {
  return typeof value === "string" && TRIP_ID_PATTERN.test(value);
}
