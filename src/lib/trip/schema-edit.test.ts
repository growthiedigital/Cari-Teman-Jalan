import { describe, expect, it } from "vitest";

import { validateTripEdit, validateTrip, type StoredTripTiming } from "./schema";

// Selasa 15 Des 2026 10:00 WIB.
const NOW = new Date("2026-12-15T03:00:00Z");
const DEVICE = "3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b";

// Trip rencana yang sudah berjalan: berangkat 10 Des (sudah lewat), pulang 20 Des.
const RENCANA: StoredTripTiming = {
  type: "rencana",
  startDate: "2026-12-10",
  endDate: "2026-12-20",
  monthStart: null,
  monthEnd: null,
};
// Trip niat dengan bulan awal Oktober (sudah lewat) sampai Januari.
const NIAT: StoredTripTiming = {
  type: "niat",
  startDate: null,
  endDate: null,
  monthStart: "2026-10-01",
  monthEnd: "2027-01-01",
};

const rencanaBody = (over: Record<string, unknown> = {}) => ({
  destination: "Labuan Bajo",
  creatorName: "Billy",
  tags: ["foodie", "alam"],
  contactType: "whatsapp",
  contactValue: "0812 3456 7890",
  startDate: "2026-12-10",
  endDate: "2026-12-20",
  ...over,
});
const niatBody = (over: Record<string, unknown> = {}) => ({
  destination: "Bali",
  creatorName: "Sari",
  tags: ["santai"],
  contactType: "instagram",
  contactValue: "@sari.jalan",
  monthStart: "2026-10-01",
  monthEnd: "2027-01-01",
  ...over,
});

function errorsOf(raw: unknown, stored: StoredTripTiming) {
  const result = validateTripEdit(raw, stored, NOW);
  if (result.ok) throw new Error("Seharusnya tidak lolos validasi");
  return result.errors;
}
function dataOf(raw: unknown, stored: StoredTripTiming) {
  const result = validateTripEdit(raw, stored, NOW);
  if (!result.ok) throw new Error(`Seharusnya lolos: ${JSON.stringify(result.errors)}`);
  return result.data;
}

describe("validateTripEdit: jenis trip tetap", () => {
  it("memakai jenis tersimpan walau `type` tidak dikirim", () => {
    expect(dataOf(rencanaBody(), RENCANA).type).toBe("rencana");
    expect(dataOf(niatBody(), NIAT).type).toBe("niat");
  });

  it("`type` yang sama diterima; yang berbeda ditolak dengan error di field type", () => {
    expect(dataOf(rencanaBody({ type: "rencana" }), RENCANA).type).toBe("rencana");
    expect(errorsOf(rencanaBody({ type: "niat" }), RENCANA).type).toBe(
      "Jenis trip tidak bisa diubah.",
    );
    expect(errorsOf(niatBody({ type: "rencana" }), NIAT).type).toBeDefined();
    expect(errorsOf(rencanaBody({ type: "ngawur" }), RENCANA).type).toBeDefined();
  });

  it("field jenis lain diabaikan: edit rencana tidak membawa bulan, edit niat tidak membawa tanggal", () => {
    const r = dataOf(rencanaBody({ monthStart: "2027-01-01", intention: "x" }), RENCANA);
    expect(r.monthStart).toBeNull();
    expect(r.intention).toBeNull();
    const n = dataOf(niatBody({ startDate: "2027-01-05", itinerary: "x" }), NIAT);
    expect(n.startDate).toBeNull();
    expect(n.itinerary).toBeNull();
  });
});

describe("validateTripEdit: tanggal masa lalu hanya bila berubah", () => {
  it("tanggal berangkat lampau yang TIDAK berubah diterima (catatan bisa diperbaiki)", () => {
    const data = dataOf(rencanaBody({ note: "Update catatan" }), RENCANA);
    expect(data.startDate).toBe("2026-12-10");
    expect(data.note).toBe("Update catatan");
  });

  it("tanggal berangkat diubah ke masa lalu ditolak (juga ke tanggal lampau lain)", () => {
    expect(errorsOf(rencanaBody({ startDate: "2026-12-11" }), RENCANA).startDate).toBe(
      "Tanggal berangkat tidak boleh di masa lalu.",
    );
    expect(errorsOf(rencanaBody({ startDate: "2020-01-01" }), RENCANA).startDate).toMatch(
      /masa lalu/,
    );
  });

  it("tanggal berangkat diubah ke hari ini atau masa depan diterima", () => {
    expect(dataOf(rencanaBody({ startDate: "2026-12-15" }), RENCANA).startDate).toBe("2026-12-15");
    expect(dataOf(rencanaBody({ startDate: "2026-12-18" }), RENCANA).startDate).toBe("2026-12-18");
  });

  it("tanggal pulang lampau yang tidak berubah diterima, yang diubah ke masa lalu ditolak", () => {
    const pastEnd: StoredTripTiming = { ...RENCANA, endDate: "2026-12-12" };
    expect(dataOf(rencanaBody({ endDate: "2026-12-12" }), pastEnd).endDate).toBe("2026-12-12");
    expect(errorsOf(rencanaBody({ endDate: "2026-12-13" }), pastEnd).endDate).toMatch(/masa lalu/);
  });

  it("tanggal pulang tetap tidak boleh sebelum berangkat", () => {
    expect(
      errorsOf(rencanaBody({ startDate: "2026-12-20", endDate: "2026-12-19" }), RENCANA).endDate,
    ).toBe("Tanggal pulang tidak boleh sebelum tanggal berangkat.");
    // berangkat dimajukan melewati pulang yang tersimpan
    expect(errorsOf(rencanaBody({ startDate: "2026-12-25" }), RENCANA).endDate).toMatch(
      /sebelum tanggal berangkat/,
    );
  });

  it("tanggal wajib dan harus valid", () => {
    expect(errorsOf(rencanaBody({ startDate: "" }), RENCANA).startDate).toMatch(/wajib/);
    expect(errorsOf(rencanaBody({ endDate: "2026-02-30" }), RENCANA).endDate).toMatch(/tidak valid/);
  });

  it("bulan awal lampau yang tidak berubah diterima; diubah ke bulan lampau lain ditolak", () => {
    expect(dataOf(niatBody(), NIAT).monthStart).toBe("2026-10-01");
    expect(errorsOf(niatBody({ monthStart: "2026-11-01" }), NIAT).monthStart).toBe(
      "Bulan awal tidak boleh di masa lalu.",
    );
    expect(dataOf(niatBody({ monthStart: "2026-12-01" }), NIAT).monthStart).toBe("2026-12-01");
    // format YYYY-MM juga dinormalisasi
    expect(dataOf(niatBody({ monthStart: "2027-02", monthEnd: "" }), NIAT).monthStart).toBe("2027-02-01");
  });

  it("bulan akhir: boleh dikosongkan, tidak boleh sebelum bulan awal, lampau yang diubah ditolak", () => {
    expect(dataOf(niatBody({ monthEnd: "" }), NIAT).monthEnd).toBeNull();
    expect(errorsOf(niatBody({ monthStart: "2027-03-01", monthEnd: "2027-02-01" }), NIAT).monthEnd).toBe(
      "Bulan akhir tidak boleh sebelum bulan awal.",
    );
    const pastEnd: StoredTripTiming = { ...NIAT, monthEnd: "2026-11-01" };
    expect(dataOf(niatBody({ monthEnd: "2026-11-01" }), pastEnd).monthEnd).toBe("2026-11-01");
    expect(errorsOf(niatBody({ monthEnd: "2026-10-01" }), NIAT).monthEnd).toMatch(/masa lalu/);
  });
});

describe("validateTripEdit: aturan lain sama dengan pembuatan", () => {
  it("batas panjang, tag 1-3, dan semua pesan per field muncul sekaligus", () => {
    const errors = errorsOf(
      rencanaBody({ destination: "x".repeat(61), tags: [], note: "n".repeat(201), creatorName: "" }),
      RENCANA,
    );
    expect(errors.destination).toBe("Tujuan maksimal 60 karakter.");
    expect(errors.tags).toBe("Pilih 1 sampai 3 tag selera.");
    expect(errors.note).toBe("Catatan maksimal 200 karakter.");
    expect(errors.creatorName).toBe("Nama wajib diisi.");
    expect(errorsOf(rencanaBody({ tags: ["a", "b", "c", "d"] }), RENCANA).tags).toBeDefined();
  });

  it("judul dikosongkan -> otomatis `Trip ke {tujuan baru}`", () => {
    expect(dataOf(rencanaBody({ title: "", destination: "Raja Ampat" }), RENCANA).title).toBe(
      "Trip ke Raja Ampat",
    );
    expect(dataOf(rencanaBody({ title: "  Judul lama  " }), RENCANA).title).toBe("Judul lama");
  });

  it("kontak dinormalisasi dan jenisnya bisa diganti", () => {
    const wa = dataOf(rencanaBody({ contactType: "whatsapp", contactValue: "0812-3456-7890" }), RENCANA);
    expect([wa.contactType, wa.contactValue]).toEqual(["whatsapp", "6281234567890"]);
    const ig = dataOf(rencanaBody({ contactType: "instagram", contactValue: "@Sari.Jalan" }), RENCANA);
    expect([ig.contactType, ig.contactValue]).toEqual(["instagram", "sari.jalan"]);
    expect(errorsOf(rencanaBody({ contactValue: "abc" }), RENCANA).contactValue).toBeDefined();
    expect(errorsOf(rencanaBody({ contactValue: "" }), RENCANA).contactValue).toMatch(/wajib/);
  });

  it("budget, jumlah teman, itinerary dan niat bisa diubah", () => {
    const r = dataOf(
      rencanaBody({ budget: "1.500.000", buddiesWanted: "3", itinerary: "Hari 1: tiba" }),
      RENCANA,
    );
    expect([r.budget, r.buddiesWanted, r.itinerary]).toEqual([1_500_000, 3, "Hari 1: tiba"]);
    const n = dataOf(niatBody({ intention: "Pengen healing" }), NIAT);
    expect(n.intention).toBe("Pengen healing");
    expect(errorsOf(rencanaBody({ buddiesWanted: "11" }), RENCANA).buddiesWanted).toBeDefined();
  });

  it("body bukan objek -> error form", () => {
    for (const raw of [null, "x", 5, [1]]) {
      expect(errorsOf(raw, RENCANA).form).toBeDefined();
    }
  });
});

describe("validateTripEdit: kolom yang tidak boleh diedit tidak ikut", () => {
  it("theme, deviceId, id, hash, snapshot, is_full diabaikan dan tidak ada di hasil", () => {
    const data = dataOf(
      rencanaBody({
        theme: "b",
        deviceId: DEVICE,
        id: "AAAAAAAAAA",
        edit_token_hash: "x",
        editTokenHash: "x",
        creator_ip_hash: "x",
        device_id: "x",
        card_snapshot: { title: "diubah" },
        cardSnapshot: { title: "diubah" },
        is_full: true,
        isFull: true,
        created_at: "2020-01-01",
      }),
      RENCANA,
    );
    expect(Object.keys(data).sort()).toEqual(
      [
        "type", "destination", "title", "creatorName", "tags", "buddiesWanted", "note",
        "budget", "contactType", "contactValue", "startDate", "endDate", "itinerary",
        "monthStart", "monthEnd", "intention",
      ].sort(),
    );
    expect(JSON.stringify(data)).not.toContain("diubah");
  });

  it("tema/deviceId yang ngawur tidak membuat edit gagal (diabaikan)", () => {
    expect(validateTripEdit(rencanaBody({ theme: "zzz", deviceId: 5 }), RENCANA, NOW).ok).toBe(true);
  });
});

describe("validateTrip (pembuatan) tidak berubah oleh refaktor", () => {
  const create = (over: Record<string, unknown> = {}) => ({
    type: "rencana",
    destination: "Labuan Bajo",
    creatorName: "Billy",
    tags: ["foodie"],
    contactType: "whatsapp",
    contactValue: "081234567890",
    startDate: "2026-12-20",
    endDate: "2026-12-25",
    deviceId: DEVICE,
    ...over,
  });

  it("masa lalu tetap ditolak saat membuat, dan tema/deviceId tetap divalidasi", () => {
    const past = validateTrip(create({ startDate: "2026-12-10" }), NOW);
    expect(past.ok).toBe(false);
    if (!past.ok) expect(past.errors.startDate).toMatch(/masa lalu/);
    const bad = validateTrip(create({ theme: "x", deviceId: "bukan-uuid" }), NOW);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.theme).toBeDefined();
      expect(bad.errors.deviceId).toBeDefined();
    }
    const ok = validateTrip(create({ theme: "b" }), NOW);
    expect(ok.ok && ok.data.theme).toBe("b");
  });
});
