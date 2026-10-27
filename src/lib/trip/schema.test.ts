import { describe, expect, it } from "vitest";

import { LIMITS } from "./constants";
import {
  currentMonthJakarta,
  formatRupiah,
  isValidDateString,
  todayJakarta,
  upcomingMonths,
} from "./dates";
import {
  normalizeInstagram,
  normalizeWhatsapp,
  validateTrip,
  type TripInput,
} from "./schema";

// Selasa 15 Des 2026 10:00 WIB.
const NOW = new Date("2026-12-15T03:00:00Z");
const DEVICE = "3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b";

const rencana = (over: Record<string, unknown> = {}) => ({
  type: "rencana",
  destination: "Labuan Bajo",
  creatorName: "Billy",
  tags: ["foodie", "alam"],
  contactType: "whatsapp",
  contactValue: "0812 3456 7890",
  startDate: "2026-12-20",
  endDate: "2026-12-25",
  deviceId: DEVICE,
  ...over,
});

const niat = (over: Record<string, unknown> = {}) => ({
  type: "niat",
  destination: "Bali",
  creatorName: "Sari",
  tags: ["santai"],
  contactType: "instagram",
  contactValue: "@sari.jalan",
  monthStart: "2027-01-01",
  deviceId: DEVICE,
  ...over,
});

function errorsOf(raw: unknown) {
  const result = validateTrip(raw, NOW);
  if (result.ok) throw new Error("Seharusnya tidak lolos validasi");
  return result.errors;
}

function dataOf(raw: unknown): TripInput {
  const result = validateTrip(raw, NOW);
  if (!result.ok) throw new Error(`Seharusnya lolos: ${JSON.stringify(result.errors)}`);
  return result.data;
}

describe("jenis rencana", () => {
  it("menerima isian minimal dan menormalkan hasilnya", () => {
    const data = dataOf(rencana());
    expect(data).toMatchObject({
      type: "rencana",
      title: "Trip ke Labuan Bajo",
      contactValue: "6281234567890",
      startDate: "2026-12-20",
      endDate: "2026-12-25",
      monthStart: null,
      monthEnd: null,
      budget: null,
      buddiesWanted: null,
      note: null,
      itinerary: null,
    });
  });

  it("menolak tanggal pulang sebelum tanggal berangkat, di field endDate", () => {
    const errors = errorsOf(rencana({ startDate: "2026-12-25", endDate: "2026-12-20" }));
    expect(errors.endDate).toBe("Tanggal pulang tidak boleh sebelum tanggal berangkat.");
    expect(errors.startDate).toBeUndefined();
  });

  it("boleh pulang di hari yang sama", () => {
    expect(validateTrip(rencana({ startDate: "2026-12-20", endDate: "2026-12-20" }), NOW).ok).toBe(true);
  });

  it("menolak tanggal berangkat di masa lalu, tapi hari ini boleh (zona Jakarta)", () => {
    expect(errorsOf(rencana({ startDate: "2026-12-14" })).startDate).toMatch(/masa lalu/);
    expect(validateTrip(rencana({ startDate: "2026-12-15", endDate: "2026-12-15" }), NOW).ok).toBe(true);
  });

  it("memakai hari di Asia/Jakarta, bukan UTC", () => {
    // 23:30 UTC tanggal 14 = 06:30 WIB tanggal 15.
    const lateUtc = new Date("2026-12-14T23:30:00Z");
    expect(todayJakarta(lateUtc)).toBe("2026-12-15");
    const ok = validateTrip(rencana({ startDate: "2026-12-15", endDate: "2026-12-16" }), lateUtc);
    expect(ok.ok).toBe(true);
  });

  it("melaporkan error pemeriksaan antar-field walau field lain juga salah", () => {
    const errors = errorsOf(
      rencana({ startDate: "2026-12-25", endDate: "2026-12-20", destination: "" }),
    );
    expect(errors.destination).toBe("Tujuan wajib diisi.");
    expect(errors.endDate).toMatch(/sebelum tanggal berangkat/);
  });

  it("menolak tanggal kosong dan tanggal yang tidak ada di kalender", () => {
    expect(errorsOf(rencana({ startDate: "", endDate: undefined }))).toMatchObject({
      startDate: "Tanggal berangkat wajib diisi.",
      endDate: "Tanggal pulang wajib diisi.",
    });
    expect(errorsOf(rencana({ startDate: "2027-02-30", endDate: "2027-03-02" })).startDate).toMatch(/tidak valid/);
    expect(isValidDateString("2028-02-29")).toBe(true);
    expect(isValidDateString("2027-02-29")).toBe(false);
  });

  it("membatasi itinerary 500 karakter dan mengabaikan field jenis lain", () => {
    expect(errorsOf(rencana({ itinerary: "x".repeat(501) })).itinerary).toMatch(/maksimal 500/);
    const data = dataOf(rencana({ itinerary: "x".repeat(500), monthStart: "2027-01", intention: "abaikan" }));
    expect(data.itinerary).toHaveLength(500);
    expect(data.monthStart).toBeNull();
    expect(data.intention).toBeNull();
  });
});

describe("jenis niat", () => {
  it("menerima bulan awal saja dan menyimpannya sebagai tanggal 1", () => {
    const data = dataOf(niat({ monthStart: "2027-03" }));
    expect(data).toMatchObject({
      type: "niat",
      monthStart: "2027-03-01",
      monthEnd: null,
      startDate: null,
      endDate: null,
      contactValue: "sari.jalan",
    });
  });

  it("bulan berjalan boleh, bulan lalu tidak", () => {
    expect(currentMonthJakarta(NOW)).toBe("2026-12-01");
    expect(validateTrip(niat({ monthStart: "2026-12-01" }), NOW).ok).toBe(true);
    expect(errorsOf(niat({ monthStart: "2026-11-01" })).monthStart).toMatch(/masa lalu/);
  });

  it("bulan awal wajib; bulan akhir tidak boleh sebelum bulan awal", () => {
    expect(errorsOf(niat({ monthStart: "" })).monthStart).toBe("Bulan awal wajib diisi.");
    const errors = errorsOf(niat({ monthStart: "2027-05-01", monthEnd: "2027-03-01" }));
    expect(errors.monthEnd).toBe("Bulan akhir tidak boleh sebelum bulan awal.");
    expect(dataOf(niat({ monthStart: "2027-05-01", monthEnd: "2027-05-01" })).monthEnd).toBe("2027-05-01");
    expect(dataOf(niat({ monthStart: "2027-05", monthEnd: "2027-07" })).monthEnd).toBe("2027-07-01");
  });

  it("menolak format bulan yang salah", () => {
    expect(errorsOf(niat({ monthStart: "2027-13" })).monthStart).toMatch(/tidak valid/);
    expect(errorsOf(niat({ monthStart: "Januari" })).monthStart).toMatch(/tidak valid/);
    expect(errorsOf(niat({ monthStart: "2027-01-15" })).monthStart).toMatch(/tidak valid/);
  });

  it("membatasi niat singkat 200 karakter", () => {
    expect(errorsOf(niat({ intention: "x".repeat(201) })).intention).toMatch(/maksimal 200/);
  });

  it("daftar bulan dimulai dari bulan berjalan dan melewati pergantian tahun", () => {
    const months = upcomingMonths(NOW, 3);
    expect(months.map((m) => m.value)).toEqual(["2026-12-01", "2027-01-01", "2027-02-01"]);
    expect(months[0].label).toBe("Desember 2026");
  });
});

describe("tag selera", () => {
  it("menolak 0 tag dan 4 tag", () => {
    expect(errorsOf(rencana({ tags: [] })).tags).toBe("Pilih 1 sampai 3 tag selera.");
    expect(errorsOf(rencana({ tags: ["foodie", "santai", "budget", "alam"] })).tags).toBe(
      "Pilih 1 sampai 3 tag selera.",
    );
    expect(errorsOf(rencana({ tags: undefined })).tags).toBeDefined();
  });

  it("menerima 1 sampai 3 tag", () => {
    expect(dataOf(rencana({ tags: ["budaya-sejarah"] })).tags).toEqual(["budaya-sejarah"]);
    expect(dataOf(rencana({ tags: ["foto-foto", "petualang", "alam"] })).tags).toHaveLength(3);
  });

  it("menolak tag di luar daftar", () => {
    expect(errorsOf(rencana({ tags: ["foodie", "hacker"] })).tags).toBe("Ada tag yang tidak dikenal.");
    expect(errorsOf(rencana({ tags: "foodie" })).tags).toBeDefined();
  });

  it("tag ganda dihitung sekali", () => {
    expect(dataOf(rencana({ tags: ["foodie", "foodie"] })).tags).toEqual(["foodie"]);
  });
});

describe("batas panjang teks", () => {
  it("tujuan maks 60, nama maks 30, judul maks 80, catatan maks 200", () => {
    expect(validateTrip(rencana({ destination: "a".repeat(60) }), NOW).ok).toBe(true);
    expect(errorsOf(rencana({ destination: "a".repeat(61) })).destination).toBe("Tujuan maksimal 60 karakter.");
    expect(errorsOf(rencana({ creatorName: "a".repeat(31) })).creatorName).toBe("Nama maksimal 30 karakter.");
    expect(errorsOf(rencana({ title: "a".repeat(81) })).title).toBe("Judul maksimal 80 karakter.");
    expect(errorsOf(rencana({ note: "a".repeat(201) })).note).toBe("Catatan maksimal 200 karakter.");
  });

  it("memangkas spasi di tepi sebelum menghitung, dan field kosong jadi null", () => {
    const data = dataOf(rencana({ destination: `  ${"a".repeat(60)}  `, note: "   ", title: "  ", itinerary: "" }));
    expect(data.destination).toHaveLength(60);
    expect(data.note).toBeNull();
    expect(data.itinerary).toBeNull();
    expect(data.title).toBe(`Trip ke ${"a".repeat(60)}`);
  });

  it("menghitung per code point seperti char_length Postgres (emoji = 1)", () => {
    expect(validateTrip(rencana({ destination: "🏝️".repeat(1) + "a".repeat(58) }), NOW).ok).toBe(true);
    expect(validateTrip(rencana({ creatorName: "😀".repeat(30) }), NOW).ok).toBe(true);
    expect(errorsOf(rencana({ creatorName: "😀".repeat(31) })).creatorName).toBeDefined();
  });

  it("tujuan dan nama wajib; teks non-string ditolak", () => {
    expect(errorsOf(rencana({ destination: "   " })).destination).toBe("Tujuan wajib diisi.");
    expect(errorsOf(rencana({ creatorName: undefined })).creatorName).toBe("Nama wajib diisi.");
    expect(errorsOf(rencana({ destination: 123 })).destination).toBe("Tujuan harus berupa teks.");
  });

  it("membuang karakter kontrol (null byte) dari teks", () => {
    expect(dataOf(rencana({ note: "halo\u0000 dunia" })).note).toBe("halo dunia");
  });
});

describe("judul otomatis", () => {
  it("kosong -> 'Trip ke {tujuan}'; terisi -> dipakai apa adanya", () => {
    expect(dataOf(rencana({ title: "" })).title).toBe("Trip ke Labuan Bajo");
    expect(dataOf(rencana({ title: "  Liburan akhir tahun " })).title).toBe("Liburan akhir tahun");
  });

  it("judul otomatis dari tujuan terpanjang tetap muat 80 karakter", () => {
    expect(dataOf(rencana({ destination: "a".repeat(60) })).title.length).toBeLessThanOrEqual(LIMITS.title);
  });
});

describe("budget dan jumlah teman", () => {
  it("budget 0 sampai 100.000.000 diterima, dalam angka maupun teks", () => {
    expect(dataOf(rencana({ budget: 0 })).budget).toBe(0);
    expect(dataOf(rencana({ budget: "100000000" })).budget).toBe(100_000_000);
    expect(dataOf(rencana({ budget: "1.500.000" })).budget).toBe(1_500_000);
    expect(dataOf(rencana({ budget: "" })).budget).toBeNull();
    expect(dataOf(rencana({ budget: null })).budget).toBeNull();
  });

  it("menolak budget negatif, di atas batas, desimal, dan bukan angka", () => {
    const range = "Budget harus antara Rp0 dan Rp100.000.000 per orang.";
    expect(errorsOf(rencana({ budget: -1 })).budget).toBe(range);
    expect(errorsOf(rencana({ budget: "-5000" })).budget).toBe(range);
    expect(errorsOf(rencana({ budget: 100_000_001 })).budget).toBe(range);
    expect(errorsOf(rencana({ budget: "100000001" })).budget).toBe(range);
    expect(errorsOf(rencana({ budget: 1.5 })).budget).toBeDefined();
    expect(errorsOf(rencana({ budget: "1,5" })).budget).toBeDefined();
    expect(errorsOf(rencana({ budget: "abc" })).budget).toBeDefined();
    expect(errorsOf(rencana({ budget: "1.5" })).budget).toBeDefined();
    expect(errorsOf(rencana({ budget: {} })).budget).toBeDefined();
  });

  it("jumlah teman 1-10", () => {
    expect(dataOf(rencana({ buddiesWanted: "1" })).buddiesWanted).toBe(1);
    expect(dataOf(rencana({ buddiesWanted: 10 })).buddiesWanted).toBe(10);
    expect(dataOf(rencana({ buddiesWanted: "" })).buddiesWanted).toBeNull();
    for (const bad of [0, 11, "0", "11", -1, 2.5, "dua"]) {
      expect(errorsOf(rencana({ buddiesWanted: bad })).buddiesWanted).toBeDefined();
    }
  });

  it("format rupiah", () => {
    expect(formatRupiah(0)).toBe("Rp0");
    expect(formatRupiah(1_500_000)).toBe("Rp1.500.000");
    expect(formatRupiah(100_000_000)).toBe("Rp100.000.000");
  });
});

describe("normalisasi WhatsApp", () => {
  const wa = (s: string) => {
    const r = normalizeWhatsapp(s);
    return r.ok ? r.value : r.message;
  };

  it("08xx -> 628xx", () => {
    expect(wa("081234567890")).toBe("6281234567890");
  });
  it("+62 dan 62 dibiarkan (tanpa plus)", () => {
    expect(wa("+6281234567890")).toBe("6281234567890");
    expect(wa("6281234567890")).toBe("6281234567890");
  });
  it("membuang spasi, tanda hubung, titik, dan kurung", () => {
    expect(wa("0812-3456-7890")).toBe("6281234567890");
    expect(wa("+62 812 3456 7890")).toBe("6281234567890");
    expect(wa(" 0812 3456  7890 ")).toBe("6281234567890");
    expect(wa("(0812) 3456.7890")).toBe("6281234567890");
  });
  it("0062... diperlakukan sebagai awalan internasional", () => {
    expect(wa("0062812345678")).toBe("62812345678");
  });
  it("8xx tanpa 0 dianggap nomor Indonesia; nomor luar negeri dengan plus dibiarkan", () => {
    expect(wa("81234567890")).toBe("6281234567890");
    expect(wa("+6591234567")).toBe("6591234567");
    expect(wa("+81 90 1234 5678")).toBe("819012345678");
  });
  it("menolak terlalu pendek (<10) dan terlalu panjang (>15)", () => {
    expect(wa("08123")).toBe("Nomor WhatsApp harus 10-15 digit.");
    expect(wa("0812345")).toBe("Nomor WhatsApp harus 10-15 digit."); // 62812345 = 8 digit
    expect(wa("+6281234567890123")).toBe("Nomor WhatsApp harus 10-15 digit.");
  });
  it("batas tepat 10 dan 15 digit diterima", () => {
    expect(wa("+6281234567")).toBe("6281234567"); // 10 digit
    expect(wa("+628123456789012")).toBe("628123456789012"); // 15 digit
    expect(wa("+6281234567890123")).toMatch(/harus/); // 16 digit
  });
  it("menolak huruf dan simbol lain", () => {
    expect(wa("0812abc4567")).toMatch(/hanya boleh berisi angka/);
    expect(wa("0812+3456789")).toMatch(/hanya boleh berisi angka/);
    expect(wa("wa.me/62812")).toMatch(/hanya boleh berisi angka/);
  });
});

describe("normalisasi Instagram", () => {
  const ig = (s: string) => {
    const r = normalizeInstagram(s);
    return r.ok ? r.value : r.message;
  };

  it("membuang awalan @ dan ＠ (fullwidth)", () => {
    expect(ig("@sari.jalan")).toBe("sari.jalan");
    expect(ig("＠sari_jalan")).toBe("sari_jalan");
    expect(ig("  @@nama ")).toBe("nama");
  });
  it("mengambil username dari URL", () => {
    expect(ig("https://www.instagram.com/sari.jalan/")).toBe("sari.jalan");
    expect(ig("instagram.com/sari.jalan?igshid=abc")).toBe("sari.jalan");
    expect(ig("http://instagram.com/@sari")).toBe("sari");
    expect(ig("https://instagr.am/Sari_99#x")).toBe("sari_99");
  });
  it("menyimpan huruf kecil", () => {
    expect(ig("Sari.Jalan")).toBe("sari.jalan");
  });
  it("menolak karakter ilegal dan URL situs lain", () => {
    const bad = "Username Instagram hanya boleh berisi huruf, angka, titik, dan garis bawah.";
    expect(ig("sari jalan")).toBe(bad);
    expect(ig("sari-jalan")).toBe(bad);
    expect(ig("sari!")).toBe(bad);
    expect(ig("https://evil.com/sari")).toBe(bad);
    expect(ig("@")).toBe(bad);
    expect(ig("sari😀")).toBe(bad);
  });
  it("batas 30 karakter", () => {
    expect(ig("a".repeat(30))).toBe("a".repeat(30));
    expect(ig("a".repeat(31))).toBe("Username Instagram maksimal 30 karakter.");
  });
});

describe("kontak di validateTrip", () => {
  it("memilih aturan sesuai jenis kontak dan melaporkan di contactValue", () => {
    expect(errorsOf(rencana({ contactValue: "123" })).contactValue).toBe("Nomor WhatsApp harus 10-15 digit.");
    expect(errorsOf(rencana({ contactType: "instagram", contactValue: "a b" })).contactValue).toMatch(/Instagram/);
    expect(dataOf(rencana({ contactType: "instagram", contactValue: "＠Nama.Saya" })).contactValue).toBe("nama.saya");
  });
  it("kontak wajib diisi dan jenis kontak harus salah satu dari dua", () => {
    expect(errorsOf(rencana({ contactValue: "  " })).contactValue).toBe("Kontak wajib diisi.");
    const errors = errorsOf(rencana({ contactType: "telegram" }));
    expect(errors.contactType).toBeDefined();
    expect(errors.contactValue).toBeUndefined();
  });
});

describe("jenis trip dan isian dasar", () => {
  it("menolak jenis trip yang tidak dikenal", () => {
    expect(errorsOf({ ...rencana(), type: "lain" }).type).toBe("Pilih jenis trip.");
  });
  it("menolak body yang bukan objek", () => {
    for (const bad of [null, undefined, "teks", 42, [], [rencana()]]) {
      expect(errorsOf(bad).form).toBeDefined();
    }
  });
  it("device_id harus UUID", () => {
    expect(errorsOf(rencana({ deviceId: "abc" })).deviceId).toMatch(/ID perangkat/);
    expect(errorsOf(rencana({ deviceId: undefined })).deviceId).toBeDefined();
  });
  it("melaporkan banyak field salah sekaligus", () => {
    const errors = errorsOf({ type: "rencana", deviceId: DEVICE });
    expect(Object.keys(errors).sort()).toEqual(
      ["contactType", "contactValue", "creatorName", "destination", "endDate", "startDate", "tags"].sort(),
    );
  });
});
