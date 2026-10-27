import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Font dimuat dari berkas lokal (tidak ada unduhan saat runtime). Plus Jakarta
// Sans, lisensi OFL; lihat src/assets/fonts/OFL.txt. Pelacakan berkas untuk
// Vercel diatur lewat `outputFileTracingIncludes` di next.config.ts.
export const CARD_FONT_FAMILY = "Plus Jakarta Sans";

const FONT_FILES = [
  { file: "PlusJakartaSans-Medium.ttf", weight: 500 },
  { file: "PlusJakartaSans-Bold.ttf", weight: 700 },
  { file: "PlusJakartaSans-ExtraBold.ttf", weight: 800 },
] as const;

export type CardFont = {
  name: string;
  data: ArrayBuffer;
  weight: 500 | 700 | 800;
  style: "normal";
};

let cached: Promise<CardFont[]> | null = null;

export function loadCardFonts(): Promise<CardFont[]> {
  cached ??= Promise.all(
    FONT_FILES.map(async ({ file, weight }) => {
      const buffer = await readFile(join(process.cwd(), "src", "assets", "fonts", file));
      const data = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      return { name: CARD_FONT_FAMILY, data, weight, style: "normal" as const };
    }),
  ).catch((error) => {
    cached = null; // jangan menyimpan kegagalan; coba lagi di permintaan berikutnya
    throw error;
  });
  return cached;
}
