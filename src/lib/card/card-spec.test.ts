import { describe, expect, it } from "vitest";

import { LONG_DESTINATION, LONG_TITLE, STRESS_CAPS, STRESS_NOSPACE } from "./fixtures";
import { parseCardSnapshot } from "./snapshot";
import {
  CARD_THEMES,
  SAFE_BOTTOM_9X16,
  SAFE_TOP_9X16,
  THEMES,
  destinationTier,
  getCardDimensions,
  getCardLayout,
  parseRatio,
  parseSize,
  sanitizeCardText,
  timeTier,
  titleIncludesDestination,
  titleTier,
  urlTier,
} from "./spec";
import {
  cardImageUrl,
  getSiteUrl,
  normalizeSiteUrl,
  shortUrl,
  siteUrlFromHeaders,
  tripUrl,
} from "./site-url";

describe("parseRatio / parseSize", () => {
  it("r: kosong -> 4x5, dua nilai sah, selain itu null", () => {
    expect(parseRatio(null)).toBe("4x5");
    expect(parseRatio(undefined)).toBe("4x5");
    expect(parseRatio("")).toBe("4x5");
    expect(parseRatio("4x5")).toBe("4x5");
    expect(parseRatio("9x16")).toBe("9x16");
    for (const bad of ["1x1", "16x9", "4X5", "9:16", " 4x5", "4x5,9x16"]) {
      expect(parseRatio(bad), bad).toBeNull();
    }
  });

  it("size: kosong -> full, hanya og yang lain", () => {
    expect(parseSize(null)).toBe("full");
    expect(parseSize("")).toBe("full");
    expect(parseSize("og")).toBe("og");
    for (const bad of ["OG", "full", "small", "1"]) expect(parseSize(bad), bad).toBeNull();
  });
});

describe("getCardDimensions", () => {
  it("ukuran penuh sesuai brief", () => {
    expect(getCardDimensions("9x16", "full")).toMatchObject({ width: 1080, height: 1920, scale: 1 });
    expect(getCardDimensions("4x5", "full")).toMatchObject({ width: 1080, height: 1350, scale: 1 });
  });

  it("og 4x5 = 600x750 lewat satu faktor skala", () => {
    const d = getCardDimensions("4x5", "og");
    expect([d.width, d.height]).toEqual([600, 750]);
    expect(d.scale).toBeCloseTo(600 / 1080);
  });
});

describe("zona aman 9x16", () => {
  it("padding atas/bawah tidak masuk area overlay", () => {
    const { padding } = getCardLayout("9x16");
    expect(padding.top).toBeGreaterThanOrEqual(SAFE_TOP_9X16);
    expect(padding.bottom).toBeGreaterThanOrEqual(SAFE_BOTTOM_9X16);
  });
});

describe("tingkatan font", () => {
  const tiers = [titleTier, destinationTier, timeTier, urlTier];

  it("makin panjang teks, ukuran font tidak pernah membesar", () => {
    for (const tier of tiers) {
      let previous = Infinity;
      for (let length = 0; length <= 120; length++) {
        const { fontSize, maxLines } = tier(length);
        expect(fontSize).toBeLessThanOrEqual(previous);
        expect(maxLines).toBeGreaterThanOrEqual(1);
        previous = fontSize;
      }
    }
  });

  it("batas judul 80 dan tujuan 60 punya tingkatan terkecil", () => {
    expect(titleTier(80).fontSize).toBeLessThan(titleTier(10).fontSize);
    expect(titleTier(80).fontSize).toBe(titleTier(200).fontSize);
    expect(destinationTier(60).fontSize).toBeLessThan(destinationTier(4).fontSize);
    expect(titleTier(LONG_TITLE.length).maxLines).toBeGreaterThanOrEqual(3);
    expect(LONG_TITLE.length).toBe(80);
    expect(LONG_DESTINATION.length).toBe(60);
    // Semua data uji ekstrem harus tetap data yang sah (tujuan <= 60, judul <= 80).
    for (const f of [STRESS_CAPS, STRESS_NOSPACE]) {
      expect(f.title.length).toBeLessThanOrEqual(80);
      expect(f.destination.length).toBeLessThanOrEqual(60);
    }
  });
});

describe("titleIncludesDestination", () => {
  it("abaikan huruf besar/kecil", () => {
    expect(titleIncludesDestination("Trip ke Labuan Bajo", "labuan bajo")).toBe(true);
    expect(titleIncludesDestination("BALI TRIP", "Bali")).toBe(true);
  });

  it("false bila judul tidak memuat tujuan", () => {
    expect(titleIncludesDestination("Healing akhir tahun", "Bali")).toBe(false);
  });

  it("tujuan kosong dianggap sudah termuat (tidak ada baris kedua)", () => {
    expect(titleIncludesDestination("Apa saja", "  ")).toBe(true);
  });
});

describe("sanitizeCardText", () => {
  it("membuang emoji dan merapikan spasi", () => {
    expect(sanitizeCardText("Trip 🌴 seru ✈️ ke Bali 🇮🇩")).toBe("Trip seru ke Bali");
    expect(sanitizeCardText("  Bali\nLombok  ")).toBe("Bali Lombok");
  });

  it("mempertahankan angka dan tanda baca", () => {
    expect(sanitizeCardText("Trip #1 2026: Bali, Lombok!")).toBe("Trip #1 2026: Bali, Lombok!");
  });
});

// Kontras WCAG antara dua warna hex.
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("palet tema", () => {
  it("ada dua tema yang berbeda", () => {
    expect(CARD_THEMES).toEqual(["a", "b"]);
    expect(THEMES.a.bg).not.toBe(THEMES.b.bg);
  });

  for (const theme of CARD_THEMES) {
    const t = THEMES[theme];
    it(`tema ${theme}: kontras teks >= 4.5:1`, () => {
      expect(contrast(t.fg, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.muted, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.fg, t.panel)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.muted, t.panel)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.chipFg, t.chipBg)).toBeGreaterThanOrEqual(4.5);
      for (const k of [t.rencana, t.niat]) {
        expect(contrast(k.onAccent, k.accent)).toBeGreaterThanOrEqual(4.5);
        // aksen dipakai sebagai warna teks/ikon langsung di atas latar kartu
        expect(contrast(k.accent, t.bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

describe("URL situs", () => {
  it("normalizeSiteUrl: buang garis miring akhir, tolak yang bukan http(s)", () => {
    expect(normalizeSiteUrl("https://trip.example.com/")).toBe("https://trip.example.com");
    expect(normalizeSiteUrl(" https://trip.example.com/// ")).toBe("https://trip.example.com");
    expect(normalizeSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeSiteUrl("https://trip.example.com/?a=1#x")).toBe("https://trip.example.com");
    expect(normalizeSiteUrl("")).toBeNull();
    expect(normalizeSiteUrl(undefined)).toBeNull();
    expect(normalizeSiteUrl("trip.example.com")).toBeNull();
    expect(normalizeSiteUrl("javascript:alert(1)")).toBeNull();
  });

  it("getSiteUrl: env diutamakan, kalau tidak origin permintaan", () => {
    const req = "https://abc.vercel.app/api/card/AbCdEfGh12?r=4x5";
    expect(getSiteUrl(req, "https://trip.example.com/")).toBe("https://trip.example.com");
    expect(getSiteUrl(req, "")).toBe("https://abc.vercel.app");
    expect(getSiteUrl(req, "bukan url")).toBe("https://abc.vercel.app");
  });

  it("siteUrlFromHeaders: host + proto, lokal memakai http", () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(siteUrlFromHeaders(h({ host: "abc.vercel.app" }), "")).toBe("https://abc.vercel.app");
    expect(
      siteUrlFromHeaders(h({ host: "abc.vercel.app", "x-forwarded-proto": "https, http" }), ""),
    ).toBe("https://abc.vercel.app");
    expect(siteUrlFromHeaders(h({ host: "localhost:3000" }), "")).toBe("http://localhost:3000");
    expect(siteUrlFromHeaders(h({ host: "x.vercel.app" }), "https://trip.example.com/")).toBe(
      "https://trip.example.com",
    );
  });

  it("tripUrl, cardImageUrl, shortUrl", () => {
    expect(tripUrl("https://t.id", "AbCdEfGh12")).toBe("https://t.id/trip/AbCdEfGh12");
    expect(cardImageUrl("https://t.id", "AbCdEfGh12", "4x5", "og")).toBe(
      "https://t.id/api/card/AbCdEfGh12?r=4x5&size=og",
    );
    expect(() => cardImageUrl("https://t.id", "pendek", "4x5")).toThrow();
    expect(shortUrl("https://t.id/trip/AbCdEfGh12")).toBe("t.id/trip/AbCdEfGh12");
  });
});

describe("parseCardSnapshot", () => {
  const valid = {
    type: "rencana",
    title: "Trip ke Bali",
    destination: "Bali",
    tags: ["foodie", "bukan-tag"],
    buddies_wanted: 2,
    start_date: "2026-12-12",
    end_date: "2026-12-15",
    month_start: null,
    month_end: null,
    theme: "b",
  };

  it("snapshot valid dibaca; tag tak dikenal dibuang", () => {
    expect(parseCardSnapshot(valid)).toMatchObject({ tags: ["foodie"], theme: "b" });
  });

  it("theme hilang/rusak -> a", () => {
    expect(parseCardSnapshot({ ...valid, theme: undefined })?.theme).toBe("a");
    expect(parseCardSnapshot({ ...valid, theme: "zzz" })?.theme).toBe("a");
  });

  it("kosong, null, atau tidak lengkap -> null (404)", () => {
    expect(parseCardSnapshot({})).toBeNull();
    expect(parseCardSnapshot(null)).toBeNull();
    expect(parseCardSnapshot([])).toBeNull();
    expect(parseCardSnapshot({ ...valid, title: "" })).toBeNull();
    expect(parseCardSnapshot({ ...valid, start_date: null })).toBeNull();
    expect(parseCardSnapshot({ ...valid, type: "niat", month_start: null })).toBeNull();
  });

  it("tidak membawa field lain (mis. kontak) ke hasil", () => {
    const parsed = parseCardSnapshot({ ...valid, contact_value: "6281", creator_name: "Billy" });
    expect(JSON.stringify(parsed)).not.toContain("6281");
    expect(JSON.stringify(parsed)).not.toContain("Billy");
  });
});
