import { isValidTripId } from "@/lib/trip/id";

/**
 * URL dasar situs (tanpa garis miring akhir) untuk QR, tautan salin, dan
 * Open Graph. `NEXT_PUBLIC_SITE_URL` diutamakan (perlu diisi bila pakai domain
 * kustom); bila kosong atau tidak valid, dipakai origin dari permintaan.
 * Tanpa `server-only` supaya bisa dipakai juga di komponen klien.
 */
export function normalizeSiteUrl(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // Hanya origin + path dasar; buang query/hash dan garis miring akhir.
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** `requestUrl` adalah URL permintaan (request.url) atau origin dari header. */
export function getSiteUrl(
  requestUrl: string,
  env: string | null | undefined = process.env.NEXT_PUBLIC_SITE_URL,
): string {
  return normalizeSiteUrl(env) ?? new URL(requestUrl).origin;
}

/** Origin dari header host (halaman server). Vercel mengisi x-forwarded-proto. */
export function siteUrlFromHeaders(
  headers: Pick<Headers, "get">,
  env: string | null | undefined = process.env.NEXT_PUBLIC_SITE_URL,
): string {
  const fromEnv = normalizeSiteUrl(env);
  if (fromEnv) return fromEnv;
  const host = headers.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  return `${proto}://${host}`;
}

export function tripUrl(siteUrl: string, id: string): string {
  return `${siteUrl}/trip/${id}`;
}

/** URL contoh untuk pratinjau di form (trip belum ada). */
export const PREVIEW_TRIP_ID = "xxxxxxxxxx";

export function cardImageUrl(
  siteUrl: string,
  id: string,
  ratio: string,
  size?: "og",
): string {
  if (!isValidTripId(id)) throw new Error("ID trip tidak valid.");
  return `${siteUrl}/api/card/${id}?r=${ratio}${size ? `&size=${size}` : ""}`;
}

/** Teks URL pendek yang dicetak di kartu: tanpa protokol. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
