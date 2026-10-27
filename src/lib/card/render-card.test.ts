import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import jsQR from "jsqr";
import { PNG } from "pngjs";
import { describe, expect, it, vi } from "vitest";

import {
  LONG_NIAT,
  LONG_RENCANA,
  STRESS_CAPS,
  STRESS_NOSPACE,
  SHORT_NIAT,
  SHORT_RENCANA,
} from "./fixtures";
import { renderCard } from "./render-card";
import type { CardSnapshot } from "./snapshot";
import {
  CARD_RATIOS,
  CARD_SIZES,
  CARD_THEMES,
  getCardDimensions,
  type CardRatio,
  type CardSize,
} from "./spec";

const URL_TRIP = "https://cari-teman-jalan.vercel.app/trip/AbCdEfGh12";
// Isi CARD_OUT_DIR untuk menyimpan PNG hasil render (pemeriksaan visual manual).
const OUT_DIR = process.env.CARD_OUT_DIR;

async function render(snapshot: CardSnapshot, ratio: CardRatio, size: CardSize = "full") {
  const response = await renderCard(snapshot, { ratio, size, url: URL_TRIP });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { response, bytes };
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("renderCard: semua kombinasi", () => {
  const fixtures: [string, CardSnapshot][] = [
    ["pendek-rencana", SHORT_RENCANA],
    ["pendek-niat", SHORT_NIAT],
    ["panjang-rencana", LONG_RENCANA],
    ["panjang-niat", LONG_NIAT],
    ["ekstrem-kapital", STRESS_CAPS],
    ["ekstrem-tanpa-spasi", STRESS_NOSPACE],
  ];

  for (const [name, fixture] of fixtures) {
    for (const theme of CARD_THEMES) {
      for (const ratio of CARD_RATIOS) {
        it(`${name} tema ${theme} ${ratio}: PNG berukuran benar dan QR terbaca`, async () => {
          const snapshot = { ...fixture, theme };
          const { response, bytes } = await render(snapshot, ratio);
          if (OUT_DIR) {
            mkdirSync(OUT_DIR, { recursive: true });
            writeFileSync(join(OUT_DIR, `${name}-${theme}-${ratio}.png`), bytes);
          }

          expect(response.headers.get("content-type")).toBe("image/png");
          expect([...bytes.subarray(0, 8)]).toEqual(PNG_MAGIC);

          const png = PNG.sync.read(bytes);
          const dims = getCardDimensions(ratio, "full");
          expect(png.width).toBe(dims.width);
          expect(png.height).toBe(dims.height);

          const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
          expect(qr?.data).toBe(URL_TRIP);
        });
      }
    }
  }
});

describe("renderCard: varian Open Graph", () => {
  for (const [name, fixture] of [
    ["pendek-rencana", SHORT_RENCANA],
    ["panjang-niat", LONG_NIAT],
  ] as const) {
    for (const theme of CARD_THEMES) {
      it(`${name} tema ${theme} 4x5 og: 600x750 dan < 300 KB`, async () => {
        const { bytes } = await render({ ...fixture, theme }, "4x5", "og");
        const png = PNG.sync.read(bytes);
        expect([png.width, png.height]).toEqual([600, 750]);
        expect(bytes.length).toBeLessThan(300 * 1024);
        if (OUT_DIR) {
          mkdirSync(OUT_DIR, { recursive: true });
          writeFileSync(join(OUT_DIR, `${name}-${theme}-4x5-og.png`), bytes);
        }
      });
    }
  }

  it("9x16 og memakai skala yang sama", async () => {
    const { bytes } = await render(SHORT_NIAT, "9x16", "og");
    const png = PNG.sync.read(bytes);
    expect([png.width, png.height]).toEqual([
      getCardDimensions("9x16", "og").width,
      getCardDimensions("9x16", "og").height,
    ]);
  });
});

describe("renderCard: header", () => {
  it("header dengan huruf besar-kecil berbeda menimpa cache-control bawaan, bukan digabung", async () => {
    const response = await renderCard(SHORT_NIAT, {
      ratio: "4x5",
      size: "og",
      url: URL_TRIP,
      headers: { "Cache-Control": "public, max-age=300", "Content-Disposition": "attachment" },
    });
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(response.headers.get("content-disposition")).toBe("attachment");
    await response.arrayBuffer();
  });

  it("emoji pada teks tidak memicu pengambilan jaringan", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { bytes } = await render({ ...SHORT_RENCANA, title: "Trip seru 🌴✈️ ke Bali" }, "4x5", "og");
    expect(bytes.length).toBeGreaterThan(1000);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// Tipe bantu agar `CARD_SIZES` terpakai: kedua ukuran valid untuk dimensi.
it("getCardDimensions mencakup semua ukuran", () => {
  for (const size of CARD_SIZES) {
    expect(getCardDimensions("4x5", size).width).toBeGreaterThan(0);
  }
});
