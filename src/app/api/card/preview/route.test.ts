import jsQR from "jsqr";
import { PNG } from "pngjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServer } = vi.hoisted(() => ({
  getSupabaseServer: vi.fn(() => {
    throw new Error("Pratinjau tidak boleh menyentuh database");
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));

import { POST } from "./route";

const DEVICE = "3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b";

function body(over: Record<string, unknown> = {}) {
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
    theme: "b",
    deviceId: DEVICE,
    ...over,
  };
}

const post = (payload: unknown, query = "?r=4x5", raw = false) =>
  POST(
    new Request(`https://situs.test/api/card/preview${query}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ? (payload as string) : JSON.stringify(payload),
    }),
  );

beforeEach(() => {
  getSupabaseServer.mockClear();
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("POST /api/card/preview", () => {
  it("data sah -> PNG, tanpa database, QR ke URL contoh, no-store", async () => {
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    expect([png.width, png.height]).toEqual([1080, 1350]);
    const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(qr?.data).toBe("https://situs.test/trip/xxxxxxxxxx");
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("9x16 memberi 1080x1920", async () => {
    const res = await post(body({ type: "niat", monthStart: "2099-01-01" }), "?r=9x16");
    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    expect([png.width, png.height]).toEqual([1080, 1920]);
  });

  it("validasi gagal -> 400 dengan pesan per field", async () => {
    const res = await post(body({ destination: "", tags: [], theme: "z" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors).toMatchObject({
      destination: "Tujuan wajib diisi.",
      tags: "Pilih 1 sampai 3 tag selera.",
      theme: "Tema kartu tidak dikenal.",
    });
  });

  it("JSON rusak -> 400; body terlalu besar -> 413; r salah -> 400", async () => {
    expect((await post("{bukan json", "?r=4x5", true)).status).toBe(400);
    expect((await post(body({ note: "x".repeat(30_000) }))).status).toBe(413);
    expect((await post(body(), "?r=1x1")).status).toBe(400);
  });

  it("nilai kontak tidak muncul di respons error maupun gambar", async () => {
    const res = await post(body({ destination: "" }));
    expect(JSON.stringify(await res.json())).not.toContain("6281234567890");
  });
});
