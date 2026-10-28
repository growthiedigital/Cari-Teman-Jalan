import { textLength } from "@/lib/trip/schema";

/**
 * Spesifikasi kartu yang murni (tanpa React/DB/server): rasio, ukuran, skala,
 * zona aman, tingkatan ukuran font, dan palet tema. Dipakai renderer, route,
 * dan klien (pilihan rasio/tema), serta diuji langsung.
 */

// ---------------------------------------------------------------------------
// Rasio dan ukuran
// ---------------------------------------------------------------------------
export const CARD_RATIOS = ["9x16", "4x5"] as const;
export type CardRatio = (typeof CARD_RATIOS)[number];
export const DEFAULT_RATIO: CardRatio = "4x5";

export const CARD_SIZES = ["full", "og"] as const;
export type CardSize = (typeof CARD_SIZES)[number];

export const CARD_THEMES = ["a", "b"] as const;
export type CardTheme = (typeof CARD_THEMES)[number];
export const DEFAULT_THEME: CardTheme = "a";

/** Semua dimensi layout ditulis dalam satuan dasar (lebar 1080) lalu dikali skala. */
export const BASE_WIDTH = 1080;
export const OG_WIDTH = 600;
const BASE_HEIGHT: Record<CardRatio, number> = { "9x16": 1920, "4x5": 1350 };

/** Label tampil untuk pilihan rasio di UI. */
export const RATIO_LABELS: Record<CardRatio, string> = {
  "9x16": "9:16",
  "4x5": "4:5",
};

/**
 * Parser parameter `r`. Kosong/tidak ada -> default; nilai lain yang tidak
 * dikenal -> null (route membalas 400).
 */
export function parseRatio(value: string | null | undefined): CardRatio | null {
  if (value === null || value === undefined || value === "") return DEFAULT_RATIO;
  return (CARD_RATIOS as readonly string[]).includes(value)
    ? (value as CardRatio)
    : null;
}

/** Parser parameter `size`: kosong -> "full", "og" -> "og", selain itu null. */
export function parseSize(value: string | null | undefined): CardSize | null {
  if (value === null || value === undefined || value === "") return "full";
  return value === "og" ? "og" : null;
}

export function getCardDimensions(
  ratio: CardRatio,
  size: CardSize,
): { width: number; height: number; scale: number } {
  const scale = size === "og" ? OG_WIDTH / BASE_WIDTH : 1;
  return {
    width: Math.round(BASE_WIDTH * scale),
    height: Math.round(BASE_HEIGHT[ratio] * scale),
    scale,
  };
}

// ---------------------------------------------------------------------------
// Zona aman (satuan dasar). Antarmuka Instagram/TikTok menutup bagian atas
// dan bawah kartu 9:16; konten penting tidak boleh masuk ke sana.
// ---------------------------------------------------------------------------
export const SAFE_TOP_9X16 = 250;
export const SAFE_BOTTOM_9X16 = 340;

export type CardPadding = { top: number; bottom: number; side: number };

export type CardLayout = {
  padding: CardPadding;
  /** Sisi QR (termasuk zona tenang), satuan dasar; dibulatkan ke kelipatan modul saat dirender. */
  qr: number;
  /** Jarak antar-bagian dan antar-blok di tengah, satuan dasar. */
  gap: number;
};

export function getCardLayout(ratio: CardRatio): CardLayout {
  // 9:16: padding sedikit lebih besar dari batas aman supaya ada napas.
  if (ratio === "9x16") {
    return {
      padding: { top: SAFE_TOP_9X16 + 30, bottom: SAFE_BOTTOM_9X16 + 30, side: 84 },
      qr: 300,
      gap: 44,
    };
  }
  // 4:5 lebih pendek, jadi QR dan jarak dikecilkan agar kasus terpanjang muat.
  return { padding: { top: 84, bottom: 84, side: 84 }, qr: 250, gap: 36 };
}

// ---------------------------------------------------------------------------
// Teks: tingkatan ukuran font dan batas baris (satuan dasar)
// ---------------------------------------------------------------------------
export type TextTier = { fontSize: number; maxLines: number };

/** Judul (maks 80 karakter). Makin panjang makin kecil; tingkat terakhir boleh 4 baris. */
export function titleTier(length: number): TextTier {
  if (length <= 14) return { fontSize: 118, maxLines: 2 };
  if (length <= 28) return { fontSize: 94, maxLines: 3 };
  if (length <= 46) return { fontSize: 78, maxLines: 3 };
  if (length <= 64) return { fontSize: 66, maxLines: 3 };
  return { fontSize: 56, maxLines: 4 };
}

/** Tujuan sebagai baris kedua (maks 60 karakter). */
export function destinationTier(length: number): TextTier {
  if (length <= 16) return { fontSize: 60, maxLines: 2 };
  if (length <= 34) return { fontSize: 50, maxLines: 2 };
  return { fontSize: 42, maxLines: 2 };
}

/** Teks waktu, mis. "28 Des 2026 - 2 Jan 2027" (<= ~25 karakter). */
export function timeTier(length: number): TextTier {
  if (length <= 16) return { fontSize: 72, maxLines: 2 };
  if (length <= 20) return { fontSize: 60, maxLines: 2 };
  return { fontSize: 50, maxLines: 2 };
}

/** URL pendek di samping QR; ruang lebarnya terbatas, jadi turun lebih cepat. */
export function urlTier(length: number): TextTier {
  if (length <= 30) return { fontSize: 36, maxLines: 3 };
  if (length <= 42) return { fontSize: 31, maxLines: 3 };
  return { fontSize: 26, maxLines: 3 };
}

/** Panjang dihitung per code point, sama dengan batas di skema. */
export function tierFor(
  tier: (length: number) => TextTier,
  text: string,
): TextTier {
  return tier(textLength(text));
}

/**
 * Teks untuk kartu: buang emoji dan penyusunnya. Font kartu hanya memuat
 * aksara Latin, dan satori akan mengunduh gambar emoji dari jaringan saat
 * runtime kalau ada emoji; itu dihindari dengan membuangnya.
 */
export function sanitizeCardText(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u200D\uFE0E\uFE0F\u20E3]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

/**
 * True bila judul sudah memuat tujuan (abaikan huruf besar/kecil dan spasi
 * di tepi); kalau tidak, tujuan tampil sebagai baris kedua.
 */
export function titleIncludesDestination(title: string, destination: string): boolean {
  const needle = destination.trim().toLocaleLowerCase("id");
  if (needle === "") return true;
  return title.toLocaleLowerCase("id").includes(needle);
}

// ---------------------------------------------------------------------------
// Palet tema. Kontras sudah diperiksa (lihat card-spec.test.ts): teks utama,
// teks redup, dan teks di atas warna aksen semuanya >= 4.5:1.
// ---------------------------------------------------------------------------
export type ThemePalette = {
  bg: string;
  fg: string;
  muted: string;
  panel: string;
  chipBg: string;
  chipFg: string;
  chipBorder: string;
  /** Aksen per jenis trip: `accent` untuk isian, `onAccent` untuk teks di atasnya. */
  rencana: { accent: string; onAccent: string };
  niat: { accent: string; onAccent: string };
};

export const THEMES: Record<CardTheme, ThemePalette> = {
  // Hangat: krem, oranye bata, plum.
  a: {
    bg: "#FFF3E0",
    fg: "#2D1A0F",
    muted: "#6B4E3B",
    panel: "#FFE2B8",
    chipBg: "#FFFFFF",
    chipFg: "#2D1A0F",
    chipBorder: "#E5C79B",
    rencana: { accent: "#C2410C", onAccent: "#FFFFFF" },
    niat: { accent: "#9D174D", onAccent: "#FFFFFF" },
  },
  // Sejuk dan gelap: biru malam, hijau toska, kuning amber.
  b: {
    bg: "#0B1D2E",
    fg: "#F3F8FC",
    muted: "#A9C0D3",
    panel: "#153049",
    chipBg: "#1B3A55",
    chipFg: "#E8F2F9",
    chipBorder: "#2F5C80",
    rencana: { accent: "#2DD4BF", onAccent: "#042B27" },
    niat: { accent: "#FBBF24", onAccent: "#2B1D00" },
  },
};

export function isCardTheme(value: unknown): value is CardTheme {
  return typeof value === "string" && (CARD_THEMES as readonly string[]).includes(value);
}
