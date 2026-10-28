import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeRow } from "../../../../../test/fake-supabase";

const { getSupabaseServer } = vi.hoisted(() => ({ getSupabaseServer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));

import { POST } from "./route";

const TOKEN = "T".repeat(43);
const OTHER_TOKEN = `${"T".repeat(42)}U`;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

function storedRow(over: FakeRow = {}): FakeRow {
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
    note: "Catatan",
    start_date: "2099-01-10",
    end_date: "2099-01-15",
    theme: "b",
    card_snapshot: { title: "Trip ke Labuan Bajo", theme: "b" },
    is_full: false,
    creator_ip_hash: "iphash",
    device_id: "3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function request(payload: unknown, raw = false) {
  return new Request("http://localhost/api/trips/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (payload as string) : JSON.stringify(payload),
  });
}

let db: ReturnType<typeof createFakeDb>;
let consoleCalls: unknown[][];

beforeEach(() => {
  db = createFakeDb([
    storedRow(),
    storedRow({ id: "zZ9yY8xX7w", edit_token_hash: hash("Z".repeat(43)) }),
  ]);
  getSupabaseServer.mockReset();
  getSupabaseServer.mockImplementation(() => db.client);
  consoleCalls = [];
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => void consoleCalls.push(args));
  }
});

describe("POST /api/trips/status (database ditiru, BUKAN Supabase sungguhan)", () => {
  it("isFull true -> 200 { ok, isFull } dan hanya is_full baris itu yang berubah", async () => {
    const before = storedRow();
    const res = await POST(request({ token: TOKEN, isFull: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, isFull: true });

    expect(db.rows[0].is_full).toBe(true);
    for (const [col, value] of Object.entries(before)) {
      if (col === "is_full") continue;
      expect(db.rows[0][col], col).toEqual(value);
    }
    // baris trip lain tidak tersentuh
    expect(db.rows[1].is_full).toBe(false);
  });

  it("UPDATE hanya memuat is_full dan mencari lewat hash token", async () => {
    await POST(request({ token: TOKEN, isFull: true }));
    expect(db.log.updates).toEqual([
      { patch: { is_full: true }, filters: [["edit_token_hash", hash(TOKEN)]] },
    ]);
    expect(new Set(db.log.tables)).toEqual(new Set(["trips"]));
    expect(JSON.stringify(db.log)).not.toContain(TOKEN);
  });

  it("isFull false membuka lagi trip yang penuh", async () => {
    db = createFakeDb([storedRow({ is_full: true })]);
    const res = await POST(request({ token: TOKEN, isFull: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, isFull: false });
    expect(db.rows[0].is_full).toBe(false);
  });

  it("bisa diulang (idempotent) dan bisa dibalik", async () => {
    expect((await POST(request({ token: TOKEN, isFull: true }))).status).toBe(200);
    expect((await POST(request({ token: TOKEN, isFull: true }))).status).toBe(200);
    expect(db.rows[0].is_full).toBe(true);
    expect((await POST(request({ token: TOKEN, isFull: false }))).status).toBe(200);
    expect(db.rows[0].is_full).toBe(false);
  });

  it("kolom lain di body diabaikan: hanya is_full yang di-UPDATE", async () => {
    const before = storedRow();
    await POST(
      request({
        token: TOKEN,
        isFull: true,
        title: "Diubah",
        theme: "a",
        card_snapshot: { x: 1 },
        edit_token_hash: "x",
        end_date: "2000-01-01",
      }),
    );
    expect(Object.keys(db.log.updates[0].patch)).toEqual(["is_full"]);
    expect(db.rows[0]).toEqual({ ...before, is_full: true });
  });

  it("respons tidak memuat token, hash token, hash IP, maupun device id", async () => {
    const text = await (await POST(request({ token: TOKEN, isFull: true }))).text();
    for (const secret of [TOKEN, hash(TOKEN), "iphash", "3f2b8c1e-5a47", "edit_token_hash", "device_id"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("token salah satu karakter -> 404 generik, tanpa mengubah apa pun", async () => {
    const res = await POST(request({ token: OTHER_TOKEN, isFull: true }));
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ message: "Link edit tidak valid atau trip sudah dihapus." });
    expect(db.rows.every((r) => r.is_full === false)).toBe(true);
  });

  it("token bentuk salah / hilang -> 404 tanpa menyentuh database", async () => {
    for (const token of ["pendek", "", 123, null, undefined]) {
      expect((await POST(request({ token, isFull: true }))).status).toBe(404);
    }
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("token benar tetapi trip sudah dihapus -> 404", async () => {
    db.rows.length = 0;
    expect((await POST(request({ token: TOKEN, isFull: true }))).status).toBe(404);
  });

  it("isFull bukan boolean -> 400 tanpa menyentuh database", async () => {
    for (const isFull of ["true", "false", 1, 0, null, [], {}, undefined]) {
      const res = await POST(request({ token: TOKEN, isFull }));
      expect(res.status, JSON.stringify(isFull)).toBe(400);
    }
    expect(getSupabaseServer).not.toHaveBeenCalled();
    expect(db.rows[0].is_full).toBe(false);
  });

  it("JSON rusak, body bukan objek, dan body terlalu besar", async () => {
    expect((await POST(request("{rusak", true))).status).toBe(400);
    expect((await POST(request([1, 2]))).status).toBe(400);
    expect((await POST(request("null", true))).status).toBe(400);
    expect((await POST(request({ token: TOKEN, isFull: true, x: "y".repeat(5_000) }))).status).toBe(413);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("galat database -> 500 generik, token tidak muncul di respons maupun log", async () => {
    db = createFakeDb([storedRow()], { error: { code: "XX000" } });
    const res = await POST(request({ token: TOKEN, isFull: true }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("XX000");
    expect(consoleCalls.length).toBeGreaterThan(0);
    expect(JSON.stringify(consoleCalls)).not.toContain(TOKEN);
    expect(JSON.stringify(consoleCalls)).not.toContain(hash(TOKEN));
  });
});
