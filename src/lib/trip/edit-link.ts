/**
 * Token edit: 32 byte acak dalam base64url = persis 43 karakter (lihat
 * generateEditToken di secrets.ts). Tanpa `server-only` supaya bisa dipakai
 * di komponen klien; berisi pembangun link saja, tidak ada rahasia.
 */
const EDIT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isValidEditToken(value: unknown): value is string {
  return typeof value === "string" && EDIT_TOKEN_PATTERN.test(value);
}

/** Path halaman edit, relatif terhadap situs. */
export function editPath(token: string): string {
  return `/edit/${token}`;
}

/** Link edit lengkap yang disalin pembuat: `{situs}/edit/{token}`. */
export function editUrl(siteUrl: string, token: string): string {
  return `${siteUrl}${editPath(token)}`;
}
