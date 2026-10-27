import type { CardSnapshot } from "./snapshot";

/** Data tiruan untuk uji render dan contoh gambar (tanpa DB). */
const base = {
  buddies_wanted: 3,
  start_date: null,
  end_date: null,
  month_start: null,
  month_end: null,
} as const;

export const SHORT_RENCANA: CardSnapshot = {
  ...base,
  type: "rencana",
  title: "Trip ke Bali",
  destination: "Bali",
  tags: ["foodie", "santai"],
  buddies_wanted: 2,
  start_date: "2026-12-12",
  end_date: "2026-12-15",
  theme: "a",
};

export const SHORT_NIAT: CardSnapshot = {
  ...base,
  type: "niat",
  title: "Healing ke Bali",
  destination: "Bali",
  tags: ["santai"],
  buddies_wanted: null,
  month_start: "2026-12-01",
  theme: "a",
};

// Terpanjang: tujuan 60 karakter, judul 80 karakter, 3 tag berlabel terpanjang,
// rentang lintas tahun (teks waktu terpanjang).
export const LONG_DESTINATION =
  "Labuan Bajo, Pulau Komodo, Pulau Padar dan Pink Beach Flores"; // 60
export const LONG_TITLE =
  "Liburan akhir tahun keliling pulau-pulau cantik bareng teman baru yang seru abis"; // 80

export const LONG_RENCANA: CardSnapshot = {
  ...base,
  type: "rencana",
  title: LONG_TITLE,
  destination: LONG_DESTINATION,
  tags: ["budaya-sejarah", "petualang", "foto-foto"],
  buddies_wanted: 10,
  start_date: "2026-12-28",
  end_date: "2027-01-02",
  theme: "b",
};

export const LONG_NIAT: CardSnapshot = {
  ...base,
  type: "niat",
  title: LONG_TITLE,
  destination: LONG_DESTINATION,
  tags: ["budaya-sejarah", "petualang", "foto-foto"],
  buddies_wanted: 10,
  month_start: "2026-12-01",
  month_end: "2027-02-01",
  theme: "b",
};

// Kasus ekstrem: huruf kapital lebar semua, dan tanpa spasi sama sekali.
export const STRESS_CAPS: CardSnapshot = {
  ...LONG_RENCANA,
  title: LONG_TITLE.toUpperCase(),
  destination: LONG_DESTINATION.toUpperCase(),
  theme: "a",
};

export const STRESS_NOSPACE: CardSnapshot = {
  ...LONG_NIAT,
  title: "M".repeat(80),
  destination: "W".repeat(60),
  theme: "b",
};
