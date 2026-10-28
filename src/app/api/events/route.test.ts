import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeRow } from "../../../../test/fake-supabase";

const { getSupabaseServer, after } = vi.hoisted(() => ({
  getSupabaseServer: vi.fn(),
  after: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));
vi.mock("next/server", () => ({ after }));

import { POST } from "./route";

const ID = "aB3dE5gH7j";
const CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

function req(body: unknown, ua: string | null = CHROME, raw = false) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ua !== null) headers["user-agent"] = ua;
  return new Request("http://localhost/api/events", {
    method: "POST",
    headers,
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

let db: ReturnType<typeof createFakeDb>;
function setDb(rows: FakeRow[] = [{ id: ID, type: "niat" }], options?: { error: { code: string } }) {
  db = createFakeDb(rows, options);
  getSupabaseServer.mockReset().mockImplementation(() => db.client);
}
const events = () => db.log.inserts.filter((i) => i.table === "events").map((i) => i.row);

beforeEach(() => {
  setDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function expect204(res: Response) {
  expect(res.status).toBe(204);
  expect(await res.text()).toBe("");
  expect(res.headers.get("set-cookie")).toBeNull();
}

describe("POST /api/events: event yang diterima", () => {
  it("form_opened dengan tripType valid -> 204 dan tercatat tanpa trip_id", async () => {
    await expect204(await POST(req({ event: "form_opened", tripType: "rencana" })));
    expect(events()).toEqual([{ event: "form_opened", trip_type: "rencana", trip_id: null }]);
    expect(db.log.selects).toHaveLength(0);
  });

  it("form_opened tanpa atau dengan tripType di luar enum -> 400", async () => {
    for (const tripType of [undefined, "", "lain", 1, null]) {
      expect((await POST(req({ event: "form_opened", tripType }))).status).toBe(400);
    }
    expect(events()).toEqual([]);
  });

  for (const event of ["detail_viewed", "link_copied"]) {
    it(`${event}: trip_type diturunkan dari database, nilai klien diabaikan`, async () => {
      // Klien mengaku "rencana", database bilang "niat".
      await expect204(await POST(req({ event, tripId: ID, tripType: "rencana" })));
      expect(events()).toEqual([{ event, trip_type: "niat", trip_id: ID }]);
      expect(db.log.selects).toEqual([{ columns: "type", filters: [["id", ID]] }]);
    });

    it(`${event}: tripId tidak valid atau tidak ada -> 400 / 204 tanpa catat`, async () => {
      for (const tripId of [undefined, "", "pendek", "../../etc/pw", 123]) {
        expect((await POST(req({ event, tripId }))).status).toBe(400);
      }
      await expect204(await POST(req({ event, tripId: "zZ9yY8xX7w" }))); // trip tidak ada
      expect(events()).toEqual([]);
    });
  }
});

describe("POST /api/events: event khusus server ditolak", () => {
  for (const event of ["trip_created", "card_downloaded", "contact_clicked", "ngawur", ""]) {
    it(`${event || "(kosong)"} -> 400 tanpa tulis`, async () => {
      const res = await POST(req({ event, tripId: ID, tripType: "niat" }));
      expect(res.status).toBe(400);
      expect(events()).toEqual([]);
      expect(db.log.selects).toHaveLength(0);
    });
  }
});

describe("POST /api/events: bot", () => {
  const BOTS = [null, "", "WhatsApp/2.23.20.0 A", "facebookexternalhit/1.1", "curl/8.4.0", "Slackbot-LinkExpanding 1.0"];
  for (const ua of BOTS) {
    it(`UA ${JSON.stringify(ua)} -> 204 tanpa menulis dan tanpa menyentuh database`, async () => {
      await expect204(await POST(req({ event: "detail_viewed", tripId: ID }, ua)));
      await expect204(await POST(req({ event: "form_opened", tripType: "niat" }, ua)));
      expect(events()).toEqual([]);
      expect(db.log.selects).toHaveLength(0);
    });
  }

  it("browser dalam aplikasi Instagram bukan bot", async () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 330.0.0.34.108";
    await POST(req({ event: "detail_viewed", tripId: ID }, ua));
    expect(events()).toHaveLength(1);
  });
});

describe("POST /api/events: body tidak valid", () => {
  it("JSON rusak, bukan objek, kosong -> 400", async () => {
    for (const raw of ["{rusak", "[1]", "null", '"teks"', "42", ""]) {
      expect((await POST(req(raw, CHROME, true))).status).toBe(400);
    }
    expect(events()).toEqual([]);
  });

  it("body terlalu besar -> 400 tanpa menyentuh database", async () => {
    const res = await POST(req({ event: "form_opened", tripType: "niat", pad: "x".repeat(2_000) }));
    expect(res.status).toBe(400);
    expect(events()).toEqual([]);
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("sendBeacon dengan Blob application/json terbaca sebagai JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "user-agent": CHROME },
        body: new Blob([JSON.stringify({ event: "form_opened", tripType: "niat" })], {
          type: "application/json",
        }),
      }),
    );
    expect(res.status).toBe(204);
    expect(events()).toHaveLength(1);
  });
});

describe("POST /api/events: kegagalan database tidak menjadi galat", () => {
  it("error saat mencari trip -> 204, tidak ada catatan", async () => {
    setDb([], { error: { code: "XX000" } });
    await expect204(await POST(req({ event: "detail_viewed", tripId: ID })));
  });

  it("client Supabase melempar -> 204", async () => {
    getSupabaseServer.mockImplementation(() => {
      throw new Error("Env SUPABASE_URL belum diisi.");
    });
    await expect204(await POST(req({ event: "detail_viewed", tripId: ID })));
  });

  it("insert gagal -> 204", async () => {
    setDb([{ id: ID, type: "rencana" }]);
    const original = db.client.from;
    db.client.from = (table: string) => ({
      ...original(table),
      insert: () => Promise.resolve({ error: { code: "23514" } }),
    });
    await expect204(await POST(req({ event: "detail_viewed", tripId: ID })));
  });
});
