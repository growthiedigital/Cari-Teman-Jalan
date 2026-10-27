import type { ContactType } from "./constants";

/**
 * URL tujuan tombol Hubungi. Nilai kontak dari database (sudah dinormalisasi
 * di Tahap 1) tetap diperiksa lagi; bila bentuknya aneh hasilnya null, jadi
 * tidak pernah mengarahkan ke URL yang tidak diharapkan. Tanpa teks pesan.
 */
export function buildContactUrl(
  contactType: string,
  contactValue: string,
): string | null {
  if (contactType === ("whatsapp" satisfies ContactType)) {
    return /^\d{10,15}$/.test(contactValue)
      ? `https://wa.me/${contactValue}`
      : null;
  }
  if (contactType === ("instagram" satisfies ContactType)) {
    return /^[A-Za-z0-9._]{1,30}$/.test(contactValue)
      ? `https://instagram.com/${contactValue}`
      : null;
  }
  return null;
}
