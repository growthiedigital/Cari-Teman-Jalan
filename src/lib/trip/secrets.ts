import "server-only";

import { createHash, randomBytes } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** ID acak 10 karakter base62 dari crypto.randomBytes (bukan berurutan). */
export function generateTripId(length = 10): string {
  let id = "";
  while (id.length < length) {
    for (const byte of randomBytes(length * 2)) {
      // 248 = 62 * 4; buang byte >= 248 supaya sebaran merata (tanpa modulo bias).
      if (byte < 248 && id.length < length) id += BASE62[byte % 62];
    }
  }
  return id;
}

/** Token edit: 32 byte acak, base64url. Hanya hash-nya yang boleh disimpan. */
export function generateEditToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Nilai yang disimpan di `edit_token_hash` untuk sebuah token edit. */
export function hashEditToken(token: string): string {
  return sha256Hex(token);
}

/**
 * IP klien dari x-forwarded-for (elemen pertama, diisi Vercel); null bila tidak
 * bisa ditentukan.
 */
export function getKnownClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}

/** Seperti `getKnownClientIp`, tetapi "unknown" bila IP tidak diketahui. */
export function getClientIp(headers: Headers): string {
  return getKnownClientIp(headers) ?? "unknown";
}

/** SHA-256 dari (IP + IP_HASH_SALT). Melempar bila salt belum diisi. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error("Env IP_HASH_SALT belum diisi.");
  return sha256Hex(ip + salt);
}
