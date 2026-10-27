import { describe, expect, it } from "vitest";

import { buildContactUrl } from "./contact-url";
import {
  formatBudgetPerPerson,
  formatDateRange,
  formatMonthRange,
  formatTripTime,
} from "./format";
import { isValidTripId } from "./id";
import { CONTACT_COLUMNS, PUBLIC_TRIP_COLUMNS, PUBLIC_TRIP_SELECT } from "./public-columns";
import { REPORT_CONTACT_PLACEHOLDER, resolveReportContact } from "../report-contact";

describe("formatDateRange (jenis rencana)", () => {
  it("satu hari", () => {
    expect(formatDateRange("2026-12-12", "2026-12-12")).toBe("12 Des 2026");
  });
  it("satu bulan", () => {
    expect(formatDateRange("2026-12-12", "2026-12-15")).toBe("12-15 Des 2026");
  });
  it("lintas bulan, tahun sama", () => {
    expect(formatDateRange("2026-11-28", "2026-12-02")).toBe("28 Nov - 2 Des 2026");
  });
  it("lintas tahun", () => {
    expect(formatDateRange("2026-12-28", "2027-01-02")).toBe("28 Des 2026 - 2 Jan 2027");
  });
  it("tidak bergeser sehari (tanpa Date lokal)", () => {
    expect(formatDateRange("2026-01-01", "2026-01-01")).toBe("1 Jan 2026");
    expect(formatDateRange("2026-12-31", "2027-01-01")).toBe("31 Des 2026 - 1 Jan 2027");
  });
});

describe("formatMonthRange (jenis niat)", () => {
  it("satu bulan / tanpa bulan akhir", () => {
    expect(formatMonthRange("2026-12-01", null)).toBe("Perkiraan Des 2026");
    expect(formatMonthRange("2026-12-01", "2026-12-01")).toBe("Perkiraan Des 2026");
  });
  it("rentang bulan", () => {
    expect(formatMonthRange("2026-12-01", "2027-02-01")).toBe("Des 2026 - Feb 2027");
    expect(formatMonthRange("2026-03-01", "2026-05-01")).toBe("Mar 2026 - Mei 2026");
  });
});

describe("formatTripTime", () => {
  it("memilih format sesuai jenis", () => {
    const base = { start_date: null, end_date: null, month_start: null, month_end: null };
    expect(
      formatTripTime({ ...base, type: "rencana", start_date: "2026-12-12", end_date: "2026-12-15" }),
    ).toBe("12-15 Des 2026");
    expect(
      formatTripTime({ ...base, type: "niat", month_start: "2026-12-01" }),
    ).toBe("Perkiraan Des 2026");
  });
});

describe("formatBudgetPerPerson", () => {
  it("rupiah per orang", () => {
    expect(formatBudgetPerPerson(2_500_000)).toBe("Rp 2.500.000 / orang");
    expect(formatBudgetPerPerson(750_000)).toBe("Rp 750.000 / orang");
    expect(formatBudgetPerPerson(0)).toBe("Rp 0 / orang");
  });
});

describe("isValidTripId", () => {
  it("hanya 10 karakter base62", () => {
    expect(isValidTripId("aB3dE5gH7j")).toBe(true);
    expect(isValidTripId("short")).toBe(false);
    expect(isValidTripId("aB3dE5gH7jk")).toBe(false);
    expect(isValidTripId("aB3dE5gH7-")).toBe(false);
    expect(isValidTripId("aB3dE5gH7j\n")).toBe(false);
    expect(isValidTripId(undefined)).toBe(false);
    expect(isValidTripId(["aB3dE5gH7j"])).toBe(false);
  });
});

describe("buildContactUrl", () => {
  it("WhatsApp -> wa.me/{digit}, tanpa teks pesan", () => {
    expect(buildContactUrl("whatsapp", "6281234567890")).toBe("https://wa.me/6281234567890");
  });
  it("Instagram -> instagram.com/{handle}", () => {
    expect(buildContactUrl("instagram", "billy.trip_1")).toBe("https://instagram.com/billy.trip_1");
  });
  it("nilai atau jenis aneh -> null", () => {
    expect(buildContactUrl("whatsapp", "0812")).toBeNull();
    expect(buildContactUrl("whatsapp", "62812/../x")).toBeNull();
    expect(buildContactUrl("instagram", "a/b")).toBeNull();
    expect(buildContactUrl("instagram", "")).toBeNull();
    expect(buildContactUrl("telegram", "abc")).toBeNull();
  });
});

describe("kolom halaman detail", () => {
  it("persis daftar yang diizinkan", () => {
    expect([...PUBLIC_TRIP_COLUMNS].sort()).toEqual(
      [
        "id", "type", "title", "destination", "tags", "buddies_wanted", "note",
        "budget", "itinerary", "start_date", "end_date", "month_start",
        "month_end", "intention", "creator_name",
      ].sort(),
    );
  });
  it("tidak memuat kolom sensitif dan tanpa select *", () => {
    const forbidden = [
      "contact_value", "contact_type", "edit_token_hash",
      "creator_ip_hash", "device_id", "card_snapshot",
    ];
    for (const col of forbidden) {
      expect(PUBLIC_TRIP_COLUMNS).not.toContain(col);
      expect(PUBLIC_TRIP_SELECT).not.toContain(col);
    }
    expect(PUBLIC_TRIP_SELECT).not.toContain("*");
  });
  it("kolom kontak terpisah dari kolom publik", () => {
    for (const col of CONTACT_COLUMNS) {
      expect(PUBLIC_TRIP_COLUMNS).not.toContain(col);
    }
  });
});

describe("resolveReportContact", () => {
  it("kosong -> placeholder, bukan tautan", () => {
    for (const raw of [undefined, "", "   "]) {
      expect(resolveReportContact(raw)).toEqual({
        text: REPORT_CONTACT_PLACEHOLDER,
        href: null,
        configured: false,
      });
    }
  });
  it("email -> mailto (juga untuk ＠ lebar penuh)", () => {
    expect(resolveReportContact("halo@contoh.com")).toEqual({
      text: "halo@contoh.com",
      href: "mailto:halo@contoh.com",
      configured: true,
    });
    expect(resolveReportContact("halo＠contoh.com").href).toBe("mailto:halo@contoh.com");
  });
  it("teks lain tampil tanpa tautan", () => {
    expect(resolveReportContact("IG @laporan trip")).toEqual({
      text: "IG @laporan trip",
      href: null,
      configured: true,
    });
  });
});
