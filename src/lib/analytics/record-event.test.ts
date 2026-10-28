import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../../test/fake-supabase";

const { getSupabaseServer, after } = vi.hoisted(() => ({
  getSupabaseServer: vi.fn(),
  after: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));
vi.mock("next/server", () => ({ after }));

import { recordEvent, recordEventAfter } from "./record-event";

let db: ReturnType<typeof createFakeDb>;

beforeEach(() => {
  db = createFakeDb([]);
  getSupabaseServer.mockReset().mockImplementation(() => db.client);
  after.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const eventInserts = () => db.log.inserts.filter((i) => i.table === "events").map((i) => i.row);

describe("recordEvent", () => {
  it("hanya menyisipkan event, trip_type, trip_id ke tabel events", async () => {
    await recordEvent({ event: "trip_created", tripType: "niat", tripId: "aB3dE5gH7j" });
    expect(eventInserts()).toEqual([
      { event: "trip_created", trip_type: "niat", trip_id: "aB3dE5gH7j" },
    ]);
  });

  it("trip_type dan trip_id boleh kosong", async () => {
    await recordEvent({ event: "form_opened" });
    expect(eventInserts()).toEqual([{ event: "form_opened", trip_type: null, trip_id: null }]);
  });

  it("event atau jenis di luar enum: event dibuang, jenis dikosongkan", async () => {
    await recordEvent({ event: "ngawur" as never });
    await recordEvent({ event: "detail_viewed", tripType: "x" as never, tripId: "aB3dE5gH7j" });
    expect(eventInserts()).toEqual([
      { event: "detail_viewed", trip_type: null, trip_id: "aB3dE5gH7j" },
    ]);
  });

  it("tidak pernah melempar: error database, client melempar, error tak terduga", async () => {
    db = createFakeDb([], { error: { code: "XX000" } });
    await expect(recordEvent({ event: "form_opened", tripType: "rencana" })).resolves.toBeUndefined();

    getSupabaseServer.mockImplementation(() => {
      throw new Error("Env SUPABASE_URL belum diisi.");
    });
    await expect(recordEvent({ event: "form_opened", tripType: "rencana" })).resolves.toBeUndefined();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("SUPABASE_URL");
  });
});

describe("recordEventAfter", () => {
  it("menjadwalkan lewat after() dan menjalankan pencatatan di dalamnya", async () => {
    let scheduled: (() => unknown) | undefined;
    after.mockImplementation((fn: () => unknown) => {
      scheduled = fn;
    });
    recordEventAfter({ event: "card_downloaded", tripType: "rencana", tripId: "aB3dE5gH7j" });
    expect(eventInserts()).toEqual([]); // belum jalan sebelum respons selesai
    await scheduled?.();
    expect(eventInserts()).toHaveLength(1);
  });

  it("di luar lingkup permintaan (after melempar) tidak melempar ke pemanggil dan tetap mencatat", async () => {
    after.mockImplementation(() => {
      throw new Error("after was called outside a request scope");
    });
    expect(() =>
      recordEventAfter({ event: "contact_clicked", tripType: "niat", tripId: "aB3dE5gH7j" }),
    ).not.toThrow();
    await vi.waitFor(() => expect(eventInserts()).toHaveLength(1));
  });
});
