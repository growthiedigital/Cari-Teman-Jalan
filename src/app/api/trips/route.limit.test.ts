import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeRow } from "../../../../test/fake-supabase";

const { getSupabaseServer, recordEventAfter } = vi.hoisted(() => ({
  getSupabaseServer: vi.fn(),
  recordEventAfter: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));
vi.mock("@/lib/analytics/record-event", () => ({ recordEventAfter }));

import { POST } from "./route";

const DEVICE = "3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b";
const OTHER_DEVICE = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SALT = "garam-uji-garam-uji-garam-uji-1234";
const ipHash = (ip: string) => createHash("sha256").update(ip + SALT).digest("hex");
const HOUR = 3_600_000;

function body(over: Record<string, unknown> = {}) {
  return {
    type: "rencana",
    destination: "Labuan Bajo",
    creatorName: "Billy",
    tags: ["foodie"],
    contactType: "whatsapp",
    contactValue: "0812-3456-7890",
    startDate: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    deviceId: DEVICE,
    ...over,
  };
}

function request(payload: unknown, ip: string | null = "203.0.113.7") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ip) headers["x-forwarded-for"] = ip;
  return new Request("http://localhost/api/trips", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
function existing(count: number, over: FakeRow, firstHoursAgo = 1): FakeRow[] {
  // `count` trip: yang terlama `firstHoursAgo` jam lalu, sisanya makin baru.
  return Array.from({ length: count }, (_, i) => ({
    creator_ip_hash: "lain",
    device_id: "lain",
    created_at: ago(firstHoursAgo - i * 0.01),
    ...over,
  }));
}

let db: ReturnType<typeof createFakeDb>;
function setDb(rows: FakeRow[]) {
  db = createFakeDb(rows);
  getSupabaseServer.mockReset().mockImplementation(() => db.client);
}
const tripInserts = () => db.log.inserts.filter((i) => i.table === "trips");

beforeEach(() => {
  process.env.IP_HASH_SALT = SALT;
  recordEventAfter.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  setDb([]);
});

describe("POST /api/trips: batas 5 trip per 24 jam", () => {
  it("4 trip sebelumnya (IP yang sama) -> trip ke-5 berhasil", async () => {
    setDb(existing(4, { creator_ip_hash: ipHash("203.0.113.7") }));
    const res = await POST(request(body()));
    expect(res.status).toBe(201);
    expect(tripInserts()).toHaveLength(1);
  });

  it("4 trip sebelumnya (device yang sama) -> trip ke-5 berhasil", async () => {
    setDb(existing(4, { device_id: DEVICE }));
    expect((await POST(request(body()))).status).toBe(201);
  });

  it("5 trip dari IP yang sama (device baru) -> 429, tanpa insert dan tanpa event", async () => {
    setDb(existing(5, { creator_ip_hash: ipHash("203.0.113.7") }));
    const res = await POST(request(body({ deviceId: OTHER_DEVICE })));
    expect(res.status).toBe(429);
    expect(tripInserts()).toHaveLength(0);
    expect(recordEventAfter).not.toHaveBeenCalled();
  });

  it("5 trip dari device yang sama (IP baru) -> 429", async () => {
    setDb(existing(5, { device_id: DEVICE }));
    const res = await POST(request(body(), "198.51.100.9"));
    expect(res.status).toBe(429);
    expect(tripInserts()).toHaveLength(0);
  });

  it("429: pesan umum berbahasa Indonesia, Retry-After dari baris terlama, tanpa hash/IP/ID perangkat", async () => {
    setDb(existing(5, { device_id: DEVICE }, 20));
    const res = await POST(request(body()));
    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("no-store");
    // Terlama 20 jam lalu -> 4 jam lagi (toleransi selisih waktu uji).
    const retry = Number(res.headers.get("retry-after"));
    expect(retry).toBeGreaterThan(4 * 3600 - 120);
    expect(retry).toBeLessThanOrEqual(4 * 3600);
    const json = await res.json();
    expect(json).toEqual({
      message: "Kamu sudah membuat 5 trip dalam 24 jam terakhir. Coba lagi nanti.",
    });
    const text = JSON.stringify(json) + JSON.stringify([...res.headers]);
    for (const secret of [DEVICE, "203.0.113.7", ipHash("203.0.113.7")]) {
      expect(text).not.toContain(secret);
    }
  });

  it("trip lebih tua dari 24 jam tidak terhitung", async () => {
    setDb(existing(8, { device_id: DEVICE }, 30));
    expect((await POST(request(body()))).status).toBe(201);
  });

  it("IP tidak diketahui (tanpa header): hanya device_id yang dihitung", async () => {
    // Banyak trip dari "keranjang IP tak dikenal" tidak boleh memblokir pengguna lain.
    setDb(existing(9, { creator_ip_hash: ipHash("unknown") }));
    const ok = await POST(request(body({ deviceId: OTHER_DEVICE }), null));
    expect(ok.status).toBe(201);
    expect(db.log.selects.flatMap((s) => s.filters.map(([c]) => c))).not.toContain("creator_ip_hash");

    setDb(existing(5, { device_id: DEVICE }));
    expect((await POST(request(body(), null))).status).toBe(429);
  });

  it("sukses tetap menyimpan hash IP 'unknown' bila IP tidak diketahui (perilaku lama)", async () => {
    await POST(request(body(), null));
    expect(tripInserts()[0].row.creator_ip_hash).toBe(ipHash("unknown"));
  });

  it("validasi gagal -> 400 dan hitungan tidak disentuh", async () => {
    setDb(existing(5, { device_id: DEVICE }));
    const res = await POST(request(body({ destination: "" })));
    expect(res.status).toBe(400);
    expect(getSupabaseServer).not.toHaveBeenCalled();
    // device_id kosong/tidak valid ditolak oleh validasi yang ada.
    for (const deviceId of ["", "bukan-uuid", undefined]) {
      expect((await POST(request(body({ deviceId })))).status).toBe(400);
    }
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("error database saat menghitung -> 500 umum, tidak menyisipkan apa pun", async () => {
    db = createFakeDb([], { error: { code: "XX000" } });
    getSupabaseServer.mockReset().mockImplementation(() => db.client);
    const res = await POST(request(body()));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("XX000");
    expect(tripInserts()).toHaveLength(0);
  });
});
