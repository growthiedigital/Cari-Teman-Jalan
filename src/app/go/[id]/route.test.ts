import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeRow } from "../../../../test/fake-supabase";

const { getSupabaseServer, recordEventAfter } = vi.hoisted(() => ({
  getSupabaseServer: vi.fn(),
  recordEventAfter: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));
vi.mock("@/lib/analytics/record-event", () => ({ recordEventAfter }));

import { GET, HEAD } from "./route";

const ID = "aB3dE5gH7j";
const FUTURE = "2099-12-31";
const PAST = "2020-01-05";

const CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

const call = (id: string, headers: Record<string, string> = { "user-agent": CHROME }) =>
  GET(new Request(`http://localhost/go/${id}`, { headers }), {
    params: Promise.resolve({ id }),
  } as never);

function row(over: FakeRow = {}): FakeRow {
  return {
    id: ID,
    type: "rencana",
    contact_type: "whatsapp",
    contact_value: "6281234567890",
    is_full: false,
    start_date: "2099-12-25",
    end_date: FUTURE,
    ...over,
  };
}

let db: ReturnType<typeof createFakeDb>;
function setDb(rows: FakeRow[], options?: { error: { code: string } }) {
  db = createFakeDb(rows, options);
  getSupabaseServer.mockReset();
  getSupabaseServer.mockImplementation(() => db.client);
}

beforeEach(() => {
  recordEventAfter.mockClear();
  setDb([row()]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// Database ditiru (BUKAN Supabase sungguhan).
describe("GET /go/[id]", () => {
  it("trip normal WhatsApp -> 302 ke wa.me dengan header no-store dan noindex", async () => {
    const res = await call(ID);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://wa.me/6281234567890");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("trip normal Instagram -> 302 ke instagram.com", async () => {
    setDb([row({ contact_type: "instagram", contact_value: "billy.trip" })]);
    const res = await call(ID);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://instagram.com/billy.trip");
  });

  it("membaca kontak bersama is_full, type, dan end_date", async () => {
    await call(ID);
    expect(db.log.selects).toEqual([
      {
        columns: "contact_type, contact_value, is_full, type, end_date",
        filters: [["id", ID]],
      },
    ]);
  });

  it("jenis niat (tanpa tanggal pulang atau dengan tanggal lampau) -> tetap ke kontak", async () => {
    for (const end_date of [null, PAST]) {
      setDb([row({ type: "niat", end_date })]);
      const res = await call(ID);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://wa.me/6281234567890");
    }
  });

  for (const [name, over] of [
    ["is_full", { is_full: true }],
    ["kedaluwarsa", { end_date: PAST }],
    ["penuh dan kedaluwarsa", { is_full: true, end_date: PAST }],
  ] as const) {
    it(`${name} -> 302 kembali ke /trip/{id}, bukan ke kontak`, async () => {
      setDb([row(over)]);
      const res = await call(ID);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(`/trip/${ID}`);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-robots-tag")).toBe("noindex");
    });
  }

  it("trip tidak ada -> 404 no-store", async () => {
    setDb([]);
    const res = await call(ID);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("kontak rusak pada trip yang bisa dihubungi -> 404", async () => {
    setDb([row({ contact_value: "abc" })]);
    expect((await call(ID)).status).toBe(404);
  });

  it("id tidak valid -> 404 tanpa menyentuh database", async () => {
    for (const bad of ["ngawur", "../../etc/x", "aB3dE5gH7j1", ""]) {
      expect((await call(bad)).status).toBe(404);
    }
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("error database -> 500 tanpa membocorkan detail", async () => {
    setDb([row()], { error: { code: "XX000" } });
    const res = await call(ID);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toMatch(/XX000|rahasia/);
  });
});

describe("/go/[id]: analytics contact_clicked", () => {
  it("redirect sukses ke kontak -> mencatat satu event dengan trip_type dan trip_id", async () => {
    expect((await call(ID)).status).toBe(302);
    expect(recordEventAfter).toHaveBeenCalledOnce();
    expect(recordEventAfter).toHaveBeenCalledWith({
      event: "contact_clicked",
      tripType: "rencana",
      tripId: ID,
    });
  });

  it("jenis niat tercatat sebagai niat", async () => {
    setDb([row({ type: "niat", end_date: null })]);
    await call(ID);
    expect(recordEventAfter).toHaveBeenCalledWith(expect.objectContaining({ tripType: "niat" }));
  });

  it("browser dalam aplikasi Instagram tetap dicatat", async () => {
    await call(ID, {
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 330.0.0.34.108",
    });
    expect(recordEventAfter).toHaveBeenCalledOnce();
  });

  for (const [name, over] of [
    ["penuh", { is_full: true }],
    ["lewat", { end_date: PAST }],
  ] as const) {
    it(`trip ${name} -> tidak mencatat`, async () => {
      setDb([row(over)]);
      await call(ID);
      expect(recordEventAfter).not.toHaveBeenCalled();
    });
  }

  it("trip tidak ada, id tidak valid, kontak rusak, error database -> tidak mencatat", async () => {
    setDb([]);
    await call(ID);
    await call("ngawur");
    setDb([row({ contact_value: "abc" })]);
    await call(ID);
    setDb([row()], { error: { code: "XX000" } });
    await call(ID);
    expect(recordEventAfter).not.toHaveBeenCalled();
  });

  it("prefetch (Purpose / Sec-Purpose) -> tetap redirect tetapi tidak mencatat", async () => {
    const prefetchHeaders: Record<string, string>[] = [
      { purpose: "prefetch" },
      { "sec-purpose": "prefetch;anonymous-client-ip" },
    ];
    for (const h of prefetchHeaders) {
      const res = await call(ID, { "user-agent": CHROME, ...h });
      expect(res.status).toBe(302);
    }
    expect(recordEventAfter).not.toHaveBeenCalled();
  });

  it("bot / UA kosong -> tetap redirect tetapi tidak mencatat", async () => {
    for (const ua of ["WhatsApp/2.23.20.0 A", "facebookexternalhit/1.1", "curl/8.4.0", ""]) {
      const res = await call(ID, { "user-agent": ua });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://wa.me/6281234567890");
    }
    expect(recordEventAfter).not.toHaveBeenCalled();
  });

  it("pencatatan yang gagal (recordEventAfter melempar) tidak boleh menahan redirect", async () => {
    // recordEventAfter sungguhan tidak melempar; ini memastikan jalur redirect tidak bergantung padanya.
    recordEventAfter.mockImplementationOnce(() => {});
    expect((await call(ID)).status).toBe(302);
  });

  it("HEAD -> tidak mengarah ke kontak, tidak mencatat, tidak menyentuh database", async () => {
    const res = HEAD();
    expect(res.status).toBe(204);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(recordEventAfter).not.toHaveBeenCalled();
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });
});
