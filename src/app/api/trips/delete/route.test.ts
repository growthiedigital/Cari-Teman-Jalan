import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../../../../test/fake-supabase";

const { getSupabaseServer } = vi.hoisted(() => ({ getSupabaseServer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));

import { POST } from "./route";

const TOKEN = "T".repeat(43);
const OTHER_TOKEN = `${"T".repeat(42)}U`;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

function request(payload: unknown, raw = false) {
  return new Request("http://localhost/api/trips/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (payload as string) : JSON.stringify(payload),
  });
}

let db: ReturnType<typeof createFakeDb>;
let consoleCalls: unknown[][];

beforeEach(() => {
  db = createFakeDb([
    { id: "aB3dE5gH7j", edit_token_hash: hash(TOKEN) },
    { id: "zZ9yY8xX7w", edit_token_hash: hash("Z".repeat(43)) },
  ]);
  getSupabaseServer.mockReset();
  getSupabaseServer.mockImplementation(() => db.client);
  consoleCalls = [];
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void consoleCalls.push(args));
  }
});

describe("POST /api/trips/delete (database ditiru, BUKAN Supabase sungguhan)", () => {
  it("token benar -> 200 dan hanya baris itu yang terhapus (hard delete)", async () => {
    const res = await POST(request({ token: TOKEN }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
    expect(db.rows.map((r) => r.id)).toEqual(["zZ9yY8xX7w"]);
    expect(db.log.deletes).toEqual([{ filters: [["edit_token_hash", hash(TOKEN)]] }]);
    // hanya tabel trips yang disentuh; baris events tidak dihapus
    expect(new Set(db.log.tables)).toEqual(new Set(["trips"]));
    expect(JSON.stringify(db.log)).not.toContain(TOKEN);
  });

  it("token salah satu karakter -> 404 generik dan tidak ada yang terhapus", async () => {
    const res = await POST(request({ token: OTHER_TOKEN }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "Link edit tidak valid atau trip sudah dihapus." });
    expect(db.rows).toHaveLength(2);
  });

  it("menghapus dua kali -> kedua kalinya 404", async () => {
    expect((await POST(request({ token: TOKEN }))).status).toBe(200);
    expect((await POST(request({ token: TOKEN }))).status).toBe(404);
  });

  it("token bentuk salah / body aneh -> 404 atau 400 tanpa menyentuh database", async () => {
    for (const payload of [{}, { token: "pendek" }, { token: 5 }, [], null, "x"]) {
      expect((await POST(request(payload))).status).toBe(404);
    }
    expect((await POST(request("{rusak", true))).status).toBe(400);
    expect((await POST(request({ token: "x".repeat(5_000) }))).status).toBe(413);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("galat database -> 500 generik, token tidak muncul di respons maupun log", async () => {
    db = createFakeDb([{ id: "aB3dE5gH7j", edit_token_hash: hash(TOKEN) }], {
      error: { code: "XX000" },
    });
    const res = await POST(request({ token: TOKEN }));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain(TOKEN);
    expect(consoleCalls.length).toBeGreaterThan(0);
    expect(JSON.stringify(consoleCalls)).not.toContain(TOKEN);
    expect(JSON.stringify(consoleCalls)).not.toContain(hash(TOKEN));
  });
});
