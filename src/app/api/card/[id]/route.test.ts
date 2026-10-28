import { PNG } from "pngjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { maybeSingle, eq, select, from, getSupabaseServer, recordEventAfter } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getSupabaseServer = vi.fn(() => ({ from }));
  return { maybeSingle, eq, select, from, getSupabaseServer, recordEventAfter: vi.fn() };
});

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));
vi.mock("@/lib/analytics/record-event", () => ({ recordEventAfter }));

import { GET } from "./route";

const ID = "AbCdEfGh12";
const SNAPSHOT = {
  type: "rencana",
  title: "Trip ke Bali",
  destination: "Bali",
  tags: ["foodie"],
  buddies_wanted: 2,
  start_date: "2026-12-12",
  end_date: "2026-12-15",
  month_start: null,
  month_end: null,
  theme: "a",
};

const CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

const call = (id: string, query = "", headers: Record<string, string> = { "user-agent": CHROME }) =>
  GET(new Request(`https://situs.test/api/card/${id}${query}`, { headers }), {
    params: Promise.resolve({ id }),
  } as never);

beforeEach(() => {
  maybeSingle.mockReset();
  eq.mockClear();
  select.mockClear();
  from.mockClear();
  getSupabaseServer.mockClear();
  recordEventAfter.mockClear();
  delete process.env.NEXT_PUBLIC_SITE_URL;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/card/[id]: validasi (tanpa database)", () => {
  it("id tidak valid -> 404 teks biasa, database tidak disentuh", async () => {
    for (const id of ["pendek", "terlalupanjang123", "AbCdEfGh1!", "../etc/pw", "AbCdEfGh1é"]) {
      const res = await call(id);
      expect(res.status, id).toBe(404);
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(await res.text()).toBe("Kartu tidak ditemukan.");
    }
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("r atau size tidak valid -> 400, database tidak disentuh", async () => {
    expect((await call(ID, "?r=1x1")).status).toBe(400);
    expect((await call(ID, "?size=big")).status).toBe(400);
    expect((await call(ID, "?size=OG")).status).toBe(400);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });
});

describe("GET /api/card/[id]: dengan database tiruan", () => {
  it("hanya membaca kolom card_snapshot", async () => {
    maybeSingle.mockResolvedValue({ data: { card_snapshot: SNAPSHOT }, error: null });
    const res = await call(ID);
    expect(res.status).toBe(200);
    expect(from).toHaveBeenCalledWith("trips");
    expect(select).toHaveBeenCalledWith("card_snapshot");
    expect(eq).toHaveBeenCalledWith("id", ID);
    await res.arrayBuffer();
  });

  it("trip tidak ada, snapshot kosong, atau rusak -> 404 tanpa detail", async () => {
    for (const data of [null, { card_snapshot: {} }, { card_snapshot: { type: "x" } }]) {
      maybeSingle.mockResolvedValue({ data, error: null });
      const res = await call(ID);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Kartu tidak ditemukan.");
    }
  });

  it("error database -> 500 tanpa membocorkan pesan", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "XX000", message: "rahasia db" } });
    const res = await call(ID);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("rahasia");
  });

  it("header cache sesuai kesepakatan dan PNG berukuran benar", async () => {
    maybeSingle.mockResolvedValue({ data: { card_snapshot: SNAPSHOT }, error: null });
    const res = await call(ID, "?r=4x5&size=og");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(res.headers.get("content-disposition")).toBeNull();
    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    expect([png.width, png.height]).toEqual([600, 750]);
  });

  it("download=1 menambah Content-Disposition attachment", async () => {
    maybeSingle.mockResolvedValue({ data: { card_snapshot: SNAPSHOT }, error: null });
    const res = await call(ID, "?r=9x16&download=1");
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="trip-card-${ID}-9x16.png"`,
    );
    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    expect([png.width, png.height]).toEqual([1080, 1920]);
  });

  it("tanpa download=1 (atau nilai lain) tidak ada attachment; r default 4x5", async () => {
    maybeSingle.mockResolvedValue({ data: { card_snapshot: SNAPSHOT }, error: null });
    const res = await call(ID, "?download=0");
    expect(res.headers.get("content-disposition")).toBeNull();
    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    expect([png.width, png.height]).toEqual([1080, 1350]);
  });
});

describe("GET /api/card/[id]: analytics card_downloaded", () => {
  const CACHED = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
  beforeEach(() => {
    maybeSingle.mockResolvedValue({ data: { card_snapshot: SNAPSHOT }, error: null });
  });

  it("download=1 sukses -> mencatat satu event dan memakai no-store", async () => {
    const res = await call(ID, "?r=4x5&download=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(recordEventAfter).toHaveBeenCalledOnce();
    expect(recordEventAfter).toHaveBeenCalledWith({
      event: "card_downloaded",
      tripType: "rencana",
      tripId: ID,
    });
    await res.arrayBuffer();
  });

  it("jenis niat tercatat sebagai niat", async () => {
    maybeSingle.mockResolvedValue({
      data: { card_snapshot: { ...SNAPSHOT, type: "niat", start_date: null, end_date: null, month_start: "2026-12-01" } },
      error: null,
    });
    const res = await call(ID, "?download=1");
    expect(recordEventAfter).toHaveBeenCalledWith(expect.objectContaining({ tripType: "niat" }));
    await res.arrayBuffer();
  });

  it("varian OG, tampilan di halaman, dan download selain 1 -> cache lama dan tidak mencatat", async () => {
    for (const query of ["", "?r=9x16", "?r=4x5&size=og", "?download=0", "?size=og&download=true"]) {
      const res = await call(ID, query);
      expect(res.status, query).toBe(200);
      expect(res.headers.get("cache-control"), query).toBe(CACHED);
      await res.arrayBuffer();
    }
    expect(recordEventAfter).not.toHaveBeenCalled();
  });

  it("gagal (404, 400, 500) -> tidak mencatat", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await call(ID, "?download=1");
    await call("ngawur", "?download=1");
    await call(ID, "?r=1x1&download=1");
    maybeSingle.mockResolvedValue({ data: null, error: { code: "XX000" } });
    await call(ID, "?download=1");
    expect(recordEventAfter).not.toHaveBeenCalled();
  });

  it("bot / UA kosong mengunduh -> gambar tetap dikirim tetapi tidak dicatat", async () => {
    for (const ua of ["WhatsApp/2.23.20.0 A", "curl/8.4.0", ""]) {
      const res = await call(ID, "?download=1", { "user-agent": ua });
      expect(res.status).toBe(200);
      await res.arrayBuffer();
    }
    expect(recordEventAfter).not.toHaveBeenCalled();
  });
});
