export type ReportContact = {
  /** Teks yang ditampilkan. */
  text: string;
  /** mailto: bila kontak berupa email, selain itu null. */
  href: string | null;
  /** False bila env belum diisi (teks placeholder). */
  configured: boolean;
};

export const REPORT_CONTACT_PLACEHOLDER = "[kontak belum diatur]";

/**
 * Kontak untuk lapor/minta hapus, dari NEXT_PUBLIC_REPORT_CONTACT.
 * Berisi "@" (atau "＠" lebar penuh) dan berbentuk email -> tautan mailto:.
 * Kosong -> placeholder yang jelas; tidak pernah memakai alamat karangan.
 */
export function resolveReportContact(raw: string | undefined): ReportContact {
  const text = (raw ?? "").trim();
  if (!text) {
    return { text: REPORT_CONTACT_PLACEHOLDER, href: null, configured: false };
  }
  const normalized = text.replace(/＠/g, "@");
  const isEmail = /^[^\s@]+@[^\s@]+$/.test(normalized);
  return {
    text: isEmail ? normalized : text,
    href: isEmail ? `mailto:${normalized}` : null,
    configured: true,
  };
}
