import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeRow } from "../../../../../test/fake-supabase";

const { getSupabaseServer } = vi.hoisted(() => ({ getSupabaseServer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));

import { EDITABLE_COLUMNS, NON_EDITABLE_COLUMNS } from "@/lib/trip/edit-columns";

import { POST } from "./route";

const TOKEN = "T".repeat(43);
const OTHER_TOKEN = `${"T".repeat(42)}U`; // beda satu karakter
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

const SNAPSHOT = {
  type: "rencana",
  title: "Trip ke Labuan Bajo",
  destination: "Labuan Bajo",
  tags: ["foodie"],
  buddies_wanted: null,
  start_date: "2020-01-10",
  end_date: "2020-01-15",
  month_start: null,
  month_end: null,
  theme: "b",
};

function storedRow(): FakeRow {
  return {
    id: "aB3dE5gH7j",
    edit_token_hash: hash(TOKEN),
    type: "rencana",
    destination: "Labuan Bajo",
    title: "Trip ke Labuan Bajo",
    creator_name: "Billy",
    contact_type: "whatsapp",
    contact_value: "6281234567890",
    tags: ["foodie"],
    buddies_wanted: null,
    note: null,
    budget: null,
    itinerary: null,
    // sudah lewat (trip sedang berjalan): harus tetap bisa diedit bila tidak diubah
    start_date: "2020-01-10",
    end_date: "2020-01-15",
    month_start: null,
    month_end: null,
    intention: null,
    theme: "b",
    card_snapshot: SNAPSHOT,
    is_full: false,
    creator_ip_hash: "iphash",
    device_id: "3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b",
    created_at: "2026-01-01T00:00:00Z",
  };
}

function body(over: Record<string, unknown> = {}) {
  return {
    token: TOKEN,
    type: "rencana",
    destination: "Raja Ampat",
    title: "",
    creatorName: "Billy",
    tags: ["foodie", "alam"],
    contactType: "instagram",
    contactValue: "@billy.jalan",
    startDate: "2020-01-10",
    endDate: "2020-01-15",
    note: "Catatan baru",
    ...over,
  };
}

function request(payload: unknown, raw = false) {
  return new Request("http://localhost/api/trips/edit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (payload as string) : JSON.stringify(payload),
  });
}

let db: ReturnType<typeof createFakeDb>;
let consoleCalls: unknown[][];

beforeEach(() => {
  db = createFakeDb([storedRow()]);
  getSupabaseServer.mockReset();
  getSupabaseServer.mockImplementation(() => db.client);
  consoleCalls = [];
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void consoleCalls.push(args));
  }
});

describe("POST /api/trips/edit: sukses (database ditiru, BUKAN Supabase sungguhan)", () => {
  it("mengubah kolom yang boleh diedit dan membalas { id, title } saja", async () => {
    const res = await POST(request(body()));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const json = await res.json();
    expect(json).toEqual({ id: "aB3dE5gH7j", title: "Trip ke Raja Ampat" });

    const row = db.rows[0];
    expect(row).toMatchObject({
      destination: "Raja Ampat",
      title: "Trip ke Raja Ampat", // judul kosong -> otomatis dari tujuan baru
      contact_type: "instagram",
      contact_value: "billy.jalan",
      tags: ["foodie", "alam"],
      note: "Catatan baru",
      start_date: "2020-01-10", // masa lalu tapi tidak berubah: diterima
    });
  });

  it("card_snapshot, theme, dan kolom terlarang lain TIDAK berubah", async () => {
    const before = storedRow();
    const res = await POST(
      request(
        body({
          theme: "a",
          card_snapshot: { title: "diubah" },
          is_full: true,
          id: "ZZZZZZZZZZ",
          edit_token_hash: "x",
          creator_ip_hash: "x",
          device_id: "x",
          type: "rencana",
        }),
      ),
    );
    expect(res.status).toBe(200);
    for (const col of NON_EDITABLE_COLUMNS) {
      if (col === "updated_at") continue; // diperbarui trigger di database sungguhan
      expect(db.rows[0][col], col).toEqual(before[col]);
    }
    expect(db.rows[0].card_snapshot).toEqual(SNAPSHOT);
  });

  it("UPDATE hanya memuat kolom yang boleh diedit, dan mencari lewat hash token", async () => {
    await POST(request(body()));
    expect(db.log.updates).toHaveLength(1);
    const [update] = db.log.updates;
    expect(Object.keys(update.patch).sort()).toEqual([...EDITABLE_COLUMNS].sort());
    expect(update.filters).toEqual([["edit_token_hash", hash(TOKEN)]]);
    // pembacaan awal juga lewat hash, bukan token mentah
    expect(db.log.selects[0].filters).toEqual([["edit_token_hash", hash(TOKEN)]]);
    expect(db.log.selects[0].columns).not.toMatch(/edit_token_hash|creator_ip_hash|device_id|card_snapshot/);
    expect(JSON.stringify(db.log)).not.toContain(TOKEN);
  });

  it("respons tidak memuat hash token, hash IP, maupun device id", async () => {
    const text = await (await POST(request(body()))).text();
    for (const secret of [hash(TOKEN), "iphash", "3f2b8c1e-5a47", TOKEN, "edit_token_hash", "device_id"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("tanggal masa lalu yang DIUBAH ditolak 400, tanpa UPDATE", async () => {
    const res = await POST(request(body({ startDate: "2020-01-11" })));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.startDate).toMatch(/masa lalu/);
    expect(db.log.updates).toHaveLength(0);
  });
});

describe("POST /api/trips/edit: gagal", () => {
  it("validasi gagal -> 400 dengan pesan per field (bentuk sama dengan Tahap 1), tanpa UPDATE", async () => {
    const res = await POST(
      request(body({ destination: "x".repeat(61), tags: [], startDate: "2099-02-01", endDate: "2099-01-01" })),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBeTypeOf("string");
    expect(json.errors).toMatchObject({
      destination: "Tujuan maksimal 60 karakter.",
      tags: "Pilih 1 sampai 3 tag selera.",
      endDate: "Tanggal pulang tidak boleh sebelum tanggal berangkat.",
    });
    expect(db.log.updates).toHaveLength(0);
    expect(db.rows[0].destination).toBe("Labuan Bajo");
  });

  it("mengubah jenis trip -> 400 di field type", async () => {
    const res = await POST(request(body({ type: "niat", monthStart: "2027-01-01" })));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.type).toBe("Jenis trip tidak bisa diubah.");
    expect(db.rows[0].type).toBe("rencana");
  });

  it("token salah satu karakter -> 404 generik, tanpa UPDATE", async () => {
    const res = await POST(request(body({ token: OTHER_TOKEN })));
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const json = await res.json();
    expect(json).toEqual({ message: "Link edit tidak valid atau trip sudah dihapus." });
    expect(db.log.updates).toHaveLength(0);
    expect(db.rows[0].destination).toBe("Labuan Bajo");
  });

  it("token bentuk salah / hilang -> 404 tanpa menyentuh database", async () => {
    for (const token of ["pendek", "", 123, null, undefined]) {
      const res = await POST(request(body({ token })));
      expect(res.status).toBe(404);
    }
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("token benar tetapi trip sudah dihapus -> 404 (validasi tidak dijalankan)", async () => {
    db.rows.length = 0;
    const res = await POST(request(body({ destination: "x".repeat(100) })));
    expect(res.status).toBe(404);
  });

  it("JSON rusak, body bukan objek, dan body terlalu besar", async () => {
    expect((await POST(request("{rusak", true))).status).toBe(400);
    expect((await POST(request([1, 2]))).status).toBe(400);
    expect((await POST(request(body({ note: "x".repeat(30_000) })))).status).toBe(413);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("galat database -> 500 generik, token tidak muncul di respons maupun log", async () => {
    db = createFakeDb([storedRow()], { error: { code: "XX000" } });
    const res = await POST(request(body()));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("XX000");
    expect(consoleCalls.length).toBeGreaterThan(0);
    expect(JSON.stringify(consoleCalls)).not.toContain(TOKEN);
    expect(JSON.stringify(consoleCalls)).not.toContain(hash(TOKEN));
  });

  it("konfigurasi database hilang -> 500 generik tanpa token di log", async () => {
    getSupabaseServer.mockImplementation(() => {
      throw new Error("Env SUPABASE_URL belum diisi.");
    });
    const res = await POST(request(body()));
    expect(res.status).toBe(500);
    expect(JSON.stringify(consoleCalls)).not.toContain(TOKEN);
  });
});

describe("POST /api/trips/edit: trip niat", () => {
  it("bulan awal lampau yang tidak berubah diterima", async () => {
    db = createFakeDb([
      {
        ...storedRow(),
        type: "niat",
        start_date: null,
        end_date: null,
        month_start: "2020-01-01",
        month_end: null,
        intention: "Lama",
      },
    ]);
    const res = await POST(
      request({
        token: TOKEN,
        destination: "Bali",
        creatorName: "Billy",
        tags: ["santai"],
        contactType: "whatsapp",
        contactValue: "081234567890",
        monthStart: "2020-01-01",
        monthEnd: "",
        intention: "Baru",
      }),
    );
    expect(res.status).toBe(200);
    expect(db.rows[0]).toMatchObject({ intention: "Baru", month_start: "2020-01-01", month_end: null });
  });
});
