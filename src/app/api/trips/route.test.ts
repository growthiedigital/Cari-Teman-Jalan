import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, from, getSupabaseServer, recordEventAfter } = vi.hoisted(() => {
  const insert = vi.fn();
  // Hitungan batas pembuatan trip: select(...).eq().gte().order().limit() -> tidak ada baris.
  const chain: Record<string, unknown> = {};
  for (const name of ["eq", "gte", "order", "limit"]) chain[name] = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
  const from = vi.fn(() => ({ insert, select: () => chain }));
  const getSupabaseServer = vi.fn(() => ({ from }));
  return { insert, from, getSupabaseServer, recordEventAfter: vi.fn() };
});

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));
vi.mock("@/lib/analytics/record-event", () => ({ recordEventAfter }));

import { POST } from "./route";

const DEVICE = "3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b";

function validBody(over: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  return {
    type: "rencana",
    destination: "Labuan Bajo",
    creatorName: "Billy",
    tags: ["foodie"],
    contactType: "whatsapp",
    contactValue: "0812-3456-7890",
    startDate: start,
    endDate: end,
    deviceId: DEVICE,
    ...over,
  };
}

function request(body: unknown, raw = false) {
  return new Request("http://localhost/api/trips", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  insert.mockReset();
  from.mockClear();
  getSupabaseServer.mockClear();
  recordEventAfter.mockClear();
  process.env.IP_HASH_SALT = "garam-uji-garam-uji-garam-uji-1234";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/trips: input tidak valid", () => {
  it("400 dengan pesan per field dan tanpa menyentuh database", async () => {
    const res = await POST(
      request(validBody({ destination: "x".repeat(61), tags: [], budget: -1 })),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toMatchObject({
      destination: "Tujuan maksimal 60 karakter.",
      tags: "Pilih 1 sampai 3 tag selera.",
    });
    expect(body.errors.budget).toBeDefined();
    expect(getSupabaseServer).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("400 untuk tanggal pulang sebelum berangkat", async () => {
    const res = await POST(request(validBody({ startDate: "2099-05-10", endDate: "2099-05-01" })));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.endDate).toMatch(/sebelum tanggal berangkat/);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("400 untuk JSON rusak dan body bukan objek", async () => {
    expect((await POST(request("{rusak", true))).status).toBe(400);
    expect((await POST(request([1, 2]))).status).toBe(400);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("413 untuk body yang terlalu besar", async () => {
    const res = await POST(request(validBody({ note: "x".repeat(30_000) })));
    expect(res.status).toBe(413);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });
});

describe("POST /api/trips: input valid (database ditiru, BUKAN Supabase sungguhan)", () => {
  it("menyimpan hash token, kontak ternormalisasi, dan hanya mengembalikan { id, editToken }", async () => {
    insert.mockResolvedValue({ error: null });
    const res = await POST(request(validBody()));
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["editToken", "id"]);
    expect(body.id).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(body.editToken).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 byte base64url

    expect(from).toHaveBeenCalledWith("trips");
    const row = insert.mock.calls[0][0];
    expect(row.id).toBe(body.id);
    expect(recordEventAfter).toHaveBeenCalledOnce();
    expect(recordEventAfter).toHaveBeenCalledWith({
      event: "trip_created",
      tripType: "rencana",
      tripId: body.id,
    });
    expect(row.edit_token_hash).toBe(createHash("sha256").update(body.editToken).digest("hex"));
    expect(JSON.stringify(row)).not.toContain(body.editToken);
    expect(row.contact_value).toBe("6281234567890");
    expect(row.title).toBe("Trip ke Labuan Bajo");
    expect(row.creator_ip_hash).toBe(
      createHash("sha256").update("203.0.113.7" + process.env.IP_HASH_SALT).digest("hex"),
    );
    expect(row.device_id).toBe(DEVICE);
    expect(row.theme).toBe("a");
    expect(row.card_snapshot).toEqual({
      type: "rencana",
      title: "Trip ke Labuan Bajo",
      destination: "Labuan Bajo",
      tags: ["foodie"],
      buddies_wanted: null,
      start_date: row.start_date,
      end_date: row.end_date,
      month_start: null,
      month_end: null,
      theme: "a",
    });
    expect(JSON.stringify(row.card_snapshot)).not.toContain("6281234567890");
    // Kontak tidak ada di respons.
    expect(JSON.stringify(body)).not.toContain("6281234567890");
  });

  it("tema b masuk ke kolom theme dan card_snapshot.theme; tema tak dikenal -> 400", async () => {
    insert.mockResolvedValue({ error: null });
    const res = await POST(request(validBody({ theme: "b" })));
    expect(res.status).toBe(201);
    const row = insert.mock.calls[0][0];
    expect(row.theme).toBe("b");
    expect(row.card_snapshot.theme).toBe("b");

    insert.mockClear();
    const bad = await POST(request(validBody({ theme: "c" })));
    expect(bad.status).toBe(400);
    expect((await bad.json()).errors).toEqual({ theme: "Tema kartu tidak dikenal." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("jenis niat disimpan sebagai tanggal 1 dan field rencana null", async () => {
    insert.mockResolvedValue({ error: null });
    const res = await POST(
      request({
        type: "niat",
        destination: "Bali",
        creatorName: "Sari",
        tags: ["santai"],
        contactType: "instagram",
        contactValue: "＠Sari.Jalan",
        monthStart: "2099-07",
        monthEnd: "2099-08",
        deviceId: DEVICE,
      }),
    );
    expect(res.status).toBe(201);
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      type: "niat",
      month_start: "2099-07-01",
      month_end: "2099-08-01",
      start_date: null,
      end_date: null,
      contact_value: "sari.jalan",
    });
  });

  it("ID bentrok (23505) diulang dengan ID baru dan token yang sama hash-nya", async () => {
    insert
      .mockResolvedValueOnce({ error: { code: "23505" } })
      .mockResolvedValueOnce({ error: null });
    const res = await POST(request(validBody()));
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledTimes(2);
    const [first, second] = insert.mock.calls.map((c) => c[0]);
    expect(first.id).not.toBe(second.id);
    expect((await res.json()).id).toBe(second.id);
  });

  it("gagal 500 dengan pesan umum, tanpa membocorkan detail atau kontak ke respons dan log", async () => {
    insert.mockResolvedValue({
      error: { code: "23514", message: "Failing row contains (6281234567890, hash...)" },
    });
    const res = await POST(request(validBody()));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("Terjadi kesalahan");
    expect(text).not.toContain("6281234567890");
    expect(text).not.toContain("Failing row");
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("6281234567890");
    expect(logged).not.toContain("Failing row");
  });

  it("500 umum bila database atau konfigurasi bermasalah (melempar)", async () => {
    getSupabaseServer.mockImplementationOnce(() => {
      throw new Error("Env SUPABASE_URL belum diisi.");
    });
    const res = await POST(request(validBody()));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("SUPABASE_URL");
  });

  it("500 bila IP_HASH_SALT kosong (tidak menyimpan hash lemah)", async () => {
    delete process.env.IP_HASH_SALT;
    const res = await POST(request(validBody()));
    expect(res.status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
  });
});
