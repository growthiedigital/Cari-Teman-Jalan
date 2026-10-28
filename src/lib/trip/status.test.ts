import { describe, expect, it } from "vitest";

import { disabledContactLabel, isExpired, tripStatus } from "./status";

// Batas waktu eksplisit (UTC). Jakarta = UTC+7, tanpa DST.
const D = "2026-12-25";
const rencana = (end_date: string | null, is_full = false) => ({
  type: "rencana",
  end_date,
  is_full,
});

describe("isExpired", () => {
  const noon = new Date("2026-12-25T05:00:00Z"); // 12:00 WIB tanggal 25

  it("end_date kemarin -> lewat; hari ini -> belum; besok -> belum", () => {
    expect(isExpired(rencana("2026-12-24"), noon)).toBe(true);
    expect(isExpired(rencana("2026-12-25"), noon)).toBe(false);
    expect(isExpired(rencana("2026-12-26"), noon)).toBe(false);
  });

  it("jenis niat tidak pernah lewat, walau punya tanggal lampau", () => {
    expect(isExpired({ type: "niat", end_date: "2020-01-01" }, noon)).toBe(false);
    expect(isExpired({ type: "niat", end_date: null }, noon)).toBe(false);
  });

  it("end_date null -> tidak lewat", () => {
    expect(isExpired(rencana(null), noon)).toBe(false);
  });

  it("UTC 17:30 tanggal D = 00:30 WIB D+1 -> lewat bila end_date = D", () => {
    expect(isExpired(rencana(D), new Date("2026-12-25T17:30:00Z"))).toBe(true);
  });

  it("UTC 16:30 tanggal D = 23:30 WIB tanggal D -> belum lewat bila end_date = D", () => {
    expect(isExpired(rencana(D), new Date("2026-12-25T16:30:00Z"))).toBe(false);
  });

  it("tepat 16:59:59 UTC belum lewat, tepat 17:00:00 UTC (00:00 WIB) lewat", () => {
    expect(isExpired(rencana(D), new Date("2026-12-25T16:59:59Z"))).toBe(false);
    expect(isExpired(rencana(D), new Date("2026-12-25T17:00:00Z"))).toBe(true);
  });

  it("batas bulan dan tahun", () => {
    expect(isExpired(rencana("2026-12-31"), new Date("2026-12-31T17:00:00Z"))).toBe(true);
    expect(isExpired(rencana("2026-12-31"), new Date("2026-12-31T16:59:59Z"))).toBe(false);
  });

  it("tidak bergantung pada zona proses (TZ server)", () => {
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "Asia/Jakarta", "America/Los_Angeles", "Pacific/Kiritimati"]) {
        process.env.TZ = tz;
        expect(isExpired(rencana(D), new Date("2026-12-25T17:30:00Z")), tz).toBe(true);
        expect(isExpired(rencana(D), new Date("2026-12-25T16:30:00Z")), tz).toBe(false);
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("tripStatus", () => {
  const before = new Date("2026-12-25T16:30:00Z");
  const after = new Date("2026-12-25T17:30:00Z");

  it("trip normal -> bisa dihubungi", () => {
    expect(tripStatus(rencana(D), before)).toEqual({
      isFull: false,
      isExpired: false,
      canContact: true,
    });
  });

  it("penuh -> tidak bisa dihubungi", () => {
    expect(tripStatus(rencana(D, true), before)).toEqual({
      isFull: true,
      isExpired: false,
      canContact: false,
    });
  });

  it("lewat -> tidak bisa dihubungi", () => {
    expect(tripStatus(rencana(D), after)).toEqual({
      isFull: false,
      isExpired: true,
      canContact: false,
    });
  });

  it("penuh dan lewat bersamaan", () => {
    expect(tripStatus(rencana(D, true), after)).toEqual({
      isFull: true,
      isExpired: true,
      canContact: false,
    });
  });

  it("niat: tidak pernah lewat, tetap bisa penuh", () => {
    const niat = { type: "niat", end_date: null };
    expect(tripStatus({ ...niat, is_full: false }, after).canContact).toBe(true);
    expect(tripStatus({ ...niat, is_full: true }, after)).toEqual({
      isFull: true,
      isExpired: false,
      canContact: false,
    });
  });
});

describe("disabledContactLabel", () => {
  it("lewat didahulukan; selain itu penuh", () => {
    expect(disabledContactLabel({ isFull: false, isExpired: true, canContact: false })).toBe(
      "Trip ini sudah lewat",
    );
    expect(disabledContactLabel({ isFull: true, isExpired: true, canContact: false })).toBe(
      "Trip ini sudah lewat",
    );
    expect(disabledContactLabel({ isFull: true, isExpired: false, canContact: false })).toBe(
      "Trip ini sudah penuh",
    );
  });
});
