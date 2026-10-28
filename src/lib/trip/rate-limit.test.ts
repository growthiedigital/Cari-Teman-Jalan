import { describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeRow } from "../../../test/fake-supabase";

import { checkTripLimit, MAX_TRIPS_PER_WINDOW, TRIP_WINDOW_MS } from "./rate-limit";

const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const IP = "hash-ip-a";
const DEVICE = "3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b";
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

function trip(createdAt: string, over: FakeRow = {}): FakeRow {
  return { creator_ip_hash: "lain", device_id: "lain", created_at: createdAt, ...over };
}
const byIp = (...ages: number[]) => ages.map((h) => trip(hoursAgo(h), { creator_ip_hash: IP }));
const byDevice = (...ages: number[]) => ages.map((h) => trip(hoursAgo(h), { device_id: DEVICE }));

function run(rows: FakeRow[], keys = { ipHash: IP as string | null, deviceId: DEVICE }) {
  const db = createFakeDb(rows);
  return { db, result: checkTripLimit(db.client as never, keys, NOW) };
}

describe("checkTripLimit", () => {
  it("konstanta: 5 trip, jendela 24 jam", () => {
    expect(MAX_TRIPS_PER_WINDOW).toBe(5);
    expect(TRIP_WINDOW_MS).toBe(24 * 3_600_000);
  });

  it("0 dan 4 baris -> diizinkan (4 lewat IP, atau 4 lewat device)", async () => {
    expect(await run([]).result).toEqual({ allowed: true });
    expect(await run(byIp(1, 2, 3, 4)).result).toEqual({ allowed: true });
    expect(await run(byDevice(1, 2, 3, 4)).result).toEqual({ allowed: true });
  });

  it("4 lewat IP + 4 lewat device (berbeda) -> tetap diizinkan: tiap kunci dihitung sendiri", async () => {
    expect(await run([...byIp(1, 2, 3, 4), ...byDevice(1, 2, 3, 4)]).result).toEqual({
      allowed: true,
    });
  });

  it("5 baris lewat IP -> ditolak", async () => {
    expect((await run(byIp(1, 2, 3, 4, 5)).result).allowed).toBe(false);
  });

  it("5 baris lewat device -> ditolak", async () => {
    expect((await run(byDevice(1, 2, 3, 4, 5)).result).allowed).toBe(false);
  });

  it("baris lebih tua dari 24 jam tidak terhitung", async () => {
    expect(await run(byIp(1, 2, 3, 4, 25)).result).toEqual({ allowed: true });
    expect(await run(byDevice(1, 2, 3, 4, 30, 48)).result).toEqual({ allowed: true });
  });

  it("jendela bergulir: baris tepat 24 jam masih terhitung, lebih lama tidak", async () => {
    expect((await run(byIp(1, 2, 3, 4, 24)).result).allowed).toBe(false);
    expect(await run(byIp(1, 2, 3, 4, 24.01)).result).toEqual({ allowed: true });
  });

  it("IP tidak diketahui -> hanya device_id yang dihitung", async () => {
    const keys = { ipHash: null, deviceId: DEVICE };
    // Banyak baris dengan hash IP yang sama tidak memblokir pengguna tanpa IP.
    expect(await run(byIp(1, 2, 3, 4, 5, 6), keys).result).toEqual({ allowed: true });
    const { db, result } = run(byDevice(1, 2, 3, 4, 5), keys);
    expect((await result).allowed).toBe(false);
    expect(db.log.selects.flatMap((s) => s.filters.map(([c]) => c))).toEqual(["device_id"]);
  });

  it("IP diketahui: kedua kunci diperiksa lewat kolom masing-masing", async () => {
    const { db, result } = run([]);
    await result;
    expect(db.log.selects.flatMap((s) => s.filters).sort()).toEqual(
      [
        ["creator_ip_hash", IP],
        ["device_id", DEVICE],
      ].sort(),
    );
  });

  it("Retry-After dihitung dari baris terlama yang terhitung (tepat 5 baris)", async () => {
    // Terlama 20 jam lalu -> keluar jendela 4 jam lagi.
    const r = await run(byIp(1, 2, 3, 4, 20)).result;
    expect(r).toEqual({ allowed: false, retryAfterSeconds: 4 * 3600 });
  });

  it("Retry-After: dibulatkan ke atas dan minimal 1 detik", async () => {
    const edge = [
      trip(new Date(NOW - TRIP_WINDOW_MS + 500).toISOString(), { device_id: DEVICE }),
      ...byDevice(1, 2, 3, 4),
    ];
    expect(await run(edge).result).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it("lebih dari 5 baris: Retry-After menunggu sampai satu slot benar-benar kosong", async () => {
    // 7 baris (8, 7, 6, 5, 4, 3, 2 jam lalu): perlu 3 baris keluar -> baris 6 jam lalu keluar (24-6 = 18 jam).
    const r = await run(byIp(8, 7, 6, 5, 4, 3, 2)).result;
    expect(r).toEqual({ allowed: false, retryAfterSeconds: (24 - 6) * 3600 });
  });

  it("kedua kunci penuh: pakai waktu yang lebih lambat", async () => {
    const r = await run([...byIp(20, 2, 3, 4, 5), ...byDevice(10, 2, 3, 4, 5)]).result;
    expect(r).toEqual({ allowed: false, retryAfterSeconds: 14 * 3600 });
  });

  it("error database dilempar (pemanggil memutuskan respons) tanpa membocorkan detail di log", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = createFakeDb([], { error: { code: "XX000" } });
    await expect(checkTripLimit(db.client as never, { ipHash: IP, deviceId: DEVICE }, NOW)).rejects.toThrow();
  });
});
