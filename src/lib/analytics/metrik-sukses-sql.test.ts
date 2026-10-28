// Memvalidasi supabase/queries/metrik-sukses.sql terhadap DATA CONTOH di Postgres
// tertanam (PGlite, di dalam proses; BUKAN Supabase sungguhan). Skema memakai
// supabase/schema.sql yang sama dengan yang dijalankan Billy.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = join(__dirname, "../../..");
const schema = readFileSync(join(root, "supabase/schema.sql"), "utf8");
const queries = readFileSync(join(root, "supabase/queries/metrik-sukses.sql"), "utf8");

let db: PGlite;
type Row = Record<string, unknown>;
let results: { rows: Row[] }[];

// Kolom `date` dikembalikan PGlite sebagai Date (tengah malam UTC); ambil teks tanggalnya.
const dayText = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

// [event, trip_type, trip_id, created_at (UTC)]
const EVENTS: [string, string, string | null, string][] = [
  // rencana: 4 form dibuka, 2 trip dibuat (A, B)
  ["form_opened", "rencana", null, "2026-03-10T03:00:00Z"],
  ["form_opened", "rencana", null, "2026-03-10T03:05:00Z"],
  ["form_opened", "rencana", null, "2026-03-10T04:00:00Z"],
  ["form_opened", "rencana", null, "2026-03-10T17:30:00Z"], // 00:30 WIB tanggal 11
  ["trip_created", "rencana", "AAAAAAAAAA", "2026-03-10T03:10:00Z"],
  ["trip_created", "rencana", "BBBBBBBBBB", "2026-03-10T17:40:00Z"],
  // A diunduh dua kali dan linknya disalin (tetap dihitung SATU trip)
  ["card_downloaded", "rencana", "AAAAAAAAAA", "2026-03-10T03:11:00Z"],
  ["card_downloaded", "rencana", "AAAAAAAAAA", "2026-03-10T03:12:00Z"],
  ["link_copied", "rencana", "AAAAAAAAAA", "2026-03-10T03:13:00Z"],
  ["detail_viewed", "rencana", "AAAAAAAAAA", "2026-03-10T05:00:00Z"],
  // niat: 3 form dibuka, 1 trip dibuat (C)
  ["form_opened", "niat", null, "2026-03-10T06:00:00Z"],
  ["form_opened", "niat", null, "2026-03-10T06:01:00Z"],
  ["form_opened", "niat", null, "2026-03-10T06:02:00Z"],
  ["trip_created", "niat", "CCCCCCCCCC", "2026-03-10T06:10:00Z"],
  ["link_copied", "niat", "CCCCCCCCCC", "2026-03-10T06:11:00Z"],
  ["contact_clicked", "niat", "CCCCCCCCCC", "2026-03-10T07:00:00Z"],
  ["contact_clicked", "niat", "CCCCCCCCCC", "2026-03-10T07:05:00Z"],
  // trip Z: tidak ada trip_created (mis. dibuat sebelum Tahap 6) -> tidak boleh dihitung
  ["card_downloaded", "rencana", "ZZZZZZZZZZ", "2026-03-10T08:00:00Z"],
  ["contact_clicked", "rencana", "ZZZZZZZZZZ", "2026-03-10T08:01:00Z"],
];

beforeAll(async () => {
  db = new PGlite();
  // Role bawaan Supabase yang dirujuk schema.sql.
  await db.exec("create role anon; create role authenticated; create role service_role;");
  await db.exec(schema);
  for (const [event, type, tripId, at] of EVENTS) {
    await db.query(
      "insert into public.events (event, trip_type, trip_id, created_at) values ($1, $2, $3, $4)",
      [event, type, tripId, at],
    );
  }
  // Satu pernyataan select per kueri; hasil exec = satu entri per pernyataan.
  results = (await db.exec(queries)) as unknown as { rows: Row[] }[];
});

afterAll(async () => {
  await db.close();
});

describe("supabase/queries/metrik-sukses.sql (PGlite, data contoh)", () => {
  it("menghasilkan lima hasil kueri", () => {
    expect(results).toHaveLength(5);
  });

  it("Kueri 1: funnel per hari (Asia/Jakarta) dan jenis", () => {
    const [q1] = results;
    const pick = (hari: string, jenis: string) =>
      q1.rows.find((r) => dayText(r.hari) === hari && r.jenis_trip === jenis);
    // 17:30 UTC = 00:30 WIB tanggal berikutnya.
    expect(pick("2026-03-11", "rencana")).toMatchObject({
      form_opened: 1,
      trip_created: 1,
      card_downloaded: 0,
    });
    expect(pick("2026-03-10", "rencana")).toMatchObject({
      form_opened: 3,
      trip_created: 1,
      card_downloaded: 3, // A x2 + Z
      link_copied: 1,
      detail_viewed: 1,
      contact_clicked: 1,
    });
    expect(pick("2026-03-10", "niat")).toMatchObject({
      form_opened: 3,
      trip_created: 1,
      link_copied: 1,
      contact_clicked: 2,
    });
    // terbaru di atas
    expect(dayText(q1.rows[0].hari)).toBe("2026-03-11");
  });

  it("Kueri 2: persentase selesai form per jenis dan total", () => {
    const rows = Object.fromEntries(results[1].rows.map((r) => [r.jenis_trip, r]));
    expect(rows.rencana).toMatchObject({ form_opened: 4, trip_created: 2 });
    expect(Number(rows.rencana.persen_selesai_form)).toBe(50);
    expect(rows.niat).toMatchObject({ form_opened: 3, trip_created: 1 });
    expect(Number(rows.niat.persen_selesai_form)).toBe(33.3);
    expect(rows.TOTAL).toMatchObject({ form_opened: 7, trip_created: 3 });
    expect(Number(rows.TOTAL.persen_selesai_form)).toBe(42.9);
    expect(results[1].rows.at(-1)?.jenis_trip).toBe("TOTAL");
  });

  it("Kueri 3: trip unik diunduh/disalin, hanya trip yang punya trip_created", () => {
    const rows = Object.fromEntries(results[2].rows.map((r) => [r.jenis_trip, r]));
    expect(rows.rencana).toMatchObject({ trip_dibuat: 2, trip_diunduh_atau_disalin: 1 });
    expect(Number(rows.rencana.persen_diunduh_atau_disalin)).toBe(50);
    expect(rows.niat).toMatchObject({ trip_dibuat: 1, trip_diunduh_atau_disalin: 1 });
    expect(Number(rows.niat.persen_diunduh_atau_disalin)).toBe(100);
    expect(rows.TOTAL).toMatchObject({ trip_dibuat: 3, trip_diunduh_atau_disalin: 2 });
    expect(Number(rows.TOTAL.persen_diunduh_atau_disalin)).toBe(66.7);
  });

  it("Kueri 4: trip unik dengan klik Hubungi dan persentasenya", () => {
    const rows = Object.fromEntries(results[3].rows.map((r) => [r.jenis_trip, r]));
    expect(rows.rencana).toMatchObject({ trip_dibuat: 2, trip_dengan_klik_hubungi: 0 });
    expect(Number(rows.rencana.persen_dengan_klik_hubungi)).toBe(0);
    expect(rows.niat).toMatchObject({ trip_dibuat: 1, trip_dengan_klik_hubungi: 1 });
    expect(rows.TOTAL).toMatchObject({ trip_dibuat: 3, trip_dengan_klik_hubungi: 1 });
    expect(Number(rows.TOTAL.persen_dengan_klik_hubungi)).toBe(33.3);
  });

  it("Kueri 5: ringkasan sama dengan baris TOTAL kueri 2-4", () => {
    const [row] = results[4].rows;
    expect(row).toMatchObject({ form_opened: 7, trip_created: 3 });
    expect(Number(row["1_persen_selesai_form"])).toBe(42.9);
    expect(Number(row["2_persen_diunduh_atau_disalin"])).toBe(66.7);
    expect(Number(row["3_persen_dengan_klik_hubungi"])).toBe(33.3);
  });

  it("tanpa data: tidak error dan persentase kosong (bukan pembagian nol)", async () => {
    const empty = new PGlite();
    await empty.exec("create role anon; create role authenticated; create role service_role;");
    await empty.exec(schema);
    const res = (await empty.exec(queries)) as unknown as { rows: Row[] }[];
    expect(res).toHaveLength(5);
    expect(res[4].rows[0]["1_persen_selesai_form"]).toBeNull();
    await empty.close();
  });
});
