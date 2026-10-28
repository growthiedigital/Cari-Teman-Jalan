// Audit Tahap 7: batas di skema validasi (src/lib/trip) harus sama dengan
// constraint database (supabase/schema.sql), dan RLS harus aktif tanpa policy.
// Dijalankan di Postgres tertanam (PGlite, di dalam proses; BUKAN Supabase
// sungguhan) memakai schema.sql yang sama dengan yang dijalankan di Supabase.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EVENT_NAMES } from "@/lib/analytics/events";
import { LIMITS, TAG_VALUES } from "@/lib/trip/constants";
import { validateTrip } from "@/lib/trip/schema";

const schema = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8");

let db: PGlite;
let seq = 0;

beforeAll(async () => {
  db = new PGlite();
  // Role bawaan Supabase yang dirujuk schema.sql.
  await db.exec("create role anon; create role authenticated; create role service_role;");
  await db.exec(schema);
});

afterAll(async () => {
  await db.close();
});

type Row = Record<string, unknown>;

/** Baris rencana yang valid; `overrides` mengganti kolom tertentu. */
function row(overrides: Row = {}): Row {
  seq += 1;
  return {
    id: `T${String(seq).padStart(9, "0")}`,
    edit_token_hash: `hash-${seq}`,
    type: "rencana",
    destination: "Labuan Bajo",
    title: "Trip ke Labuan Bajo",
    creator_name: "Billy",
    contact_type: "whatsapp",
    contact_value: "628123456789",
    tags: ["foodie"],
    start_date: "2099-01-01",
    end_date: "2099-01-05",
    creator_ip_hash: "ip",
    device_id: "dev",
    ...overrides,
  };
}

async function insert(values: Row): Promise<{ ok: boolean; message: string }> {
  const cols = Object.keys(values);
  const params = cols.map((_, i) => `$${i + 1}`);
  try {
    await db.query(
      `insert into public.trips (${cols.join(", ")}) values (${params.join(", ")})`,
      cols.map((c) => values[c]),
    );
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, message: String((error as Error).message) };
  }
}

const validInput = {
  type: "rencana",
  destination: "Labuan Bajo",
  creatorName: "Billy",
  tags: ["foodie"],
  contactType: "whatsapp",
  contactValue: "081234567890",
  startDate: "2099-01-01",
  endDate: "2099-01-05",
  deviceId: "3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b",
};

describe("batas panjang teks: skema validasi = constraint database", () => {
  // [kolom DB, field payload, batas, tambahan field jenis]
  const textFields: [string, string, number, Row, Row][] = [
    ["destination", "destination", LIMITS.destination, {}, {}],
    ["title", "title", LIMITS.title, {}, {}],
    ["creator_name", "creatorName", LIMITS.creatorName, {}, {}],
    ["note", "note", LIMITS.note, {}, {}],
    ["itinerary", "itinerary", LIMITS.itinerary, {}, {}],
    [
      "intention",
      "intention",
      LIMITS.intention,
      { type: "niat", start_date: null, end_date: null, month_start: "2099-01-01" },
      { type: "niat", startDate: undefined, endDate: undefined, monthStart: "2099-01" },
    ],
  ];

  for (const [column, field, max, dbExtra, inputExtra] of textFields) {
    it(`${column}: tepat ${max} karakter lolos, ${max + 1} ditolak (DB dan skema)`, async () => {
      const ok = "x".repeat(max);
      const tooLong = "x".repeat(max + 1);

      expect((await insert(row({ ...dbExtra, [column]: ok }))).ok).toBe(true);
      expect((await insert(row({ ...dbExtra, [column]: tooLong }))).ok).toBe(false);

      expect(validateTrip({ ...validInput, ...inputExtra, [field]: ok }).ok).toBe(true);
      expect(validateTrip({ ...validInput, ...inputExtra, [field]: tooLong }).ok).toBe(false);
    });
  }

  it("emoji dihitung per code point (sama dengan char_length Postgres)", async () => {
    const ok = "🌴".repeat(LIMITS.destination);
    expect((await insert(row({ destination: ok }))).ok).toBe(true);
    expect(validateTrip({ ...validInput, destination: ok }).ok).toBe(true);
    expect(validateTrip({ ...validInput, destination: `${ok}🌴` }).ok).toBe(false);
  });

  it("judul otomatis ('Trip ke ' + tujuan terpanjang) muat di batas judul database", async () => {
    const result = validateTrip({ ...validInput, destination: "x".repeat(LIMITS.destination) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title.length).toBeLessThanOrEqual(LIMITS.title);
    expect((await insert(row({ title: result.data.title }))).ok).toBe(true);
  });

  it("kontak terpanjang yang lolos validasi (WhatsApp 15 digit, Instagram 30 huruf) muat di kolom", async () => {
    const wa = validateTrip({ ...validInput, contactValue: "6".repeat(15) });
    const ig = validateTrip({
      ...validInput,
      contactType: "instagram",
      contactValue: "a".repeat(LIMITS.igMaxLength),
    });
    for (const result of [wa, ig]) {
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect((await insert(row({ contact_value: result.data.contactValue }))).ok).toBe(true);
    }
  });
});

describe("angka, tag, dan tanggal: skema validasi = constraint database", () => {
  it("jumlah teman 1-10", async () => {
    for (const n of [1, LIMITS.buddiesMax]) {
      expect((await insert(row({ buddies_wanted: n }))).ok).toBe(true);
      expect(validateTrip({ ...validInput, buddiesWanted: n }).ok).toBe(true);
    }
    for (const n of [0, LIMITS.buddiesMax + 1]) {
      expect((await insert(row({ buddies_wanted: n }))).ok).toBe(false);
      expect(validateTrip({ ...validInput, buddiesWanted: n }).ok).toBe(false);
    }
  });

  it("budget: batas atas skema muat di kolom int, negatif ditolak keduanya", async () => {
    expect((await insert(row({ budget: LIMITS.budgetMax }))).ok).toBe(true);
    expect(validateTrip({ ...validInput, budget: LIMITS.budgetMax }).ok).toBe(true);
    expect((await insert(row({ budget: -1 }))).ok).toBe(false);
    expect(validateTrip({ ...validInput, budget: -1 }).ok).toBe(false);
    expect(validateTrip({ ...validInput, budget: LIMITS.budgetMax + 1 }).ok).toBe(false);
  });

  it("setiap tag di aplikasi diterima database; tag asing, 0 tag, dan 4 tag ditolak keduanya", async () => {
    for (const tag of TAG_VALUES) {
      expect((await insert(row({ tags: [tag] }))).ok, tag).toBe(true);
    }
    const four = TAG_VALUES.slice(0, 4);
    for (const tags of [["asing"], [], four]) {
      expect((await insert(row({ tags }))).ok, JSON.stringify(tags)).toBe(false);
      expect(validateTrip({ ...validInput, tags }).ok, JSON.stringify(tags)).toBe(false);
    }
  });

  it("tanggal pulang sebelum berangkat ditolak keduanya", async () => {
    expect((await insert(row({ start_date: "2099-01-05", end_date: "2099-01-01" }))).ok).toBe(false);
    expect(validateTrip({ ...validInput, startDate: "2099-01-05", endDate: "2099-01-01" }).ok).toBe(false);
  });

  it("jenis niat: bulan harus tanggal 1 di database; skema selalu menghasilkan tanggal 1", async () => {
    const niat = { type: "niat", start_date: null, end_date: null };
    expect((await insert(row({ ...niat, month_start: "2099-02-02" }))).ok).toBe(false);
    const result = validateTrip({
      ...validInput,
      type: "niat",
      startDate: undefined,
      endDate: undefined,
      monthStart: "2099-02",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.monthStart).toBe("2099-02-01");
    expect((await insert(row({ ...niat, month_start: result.data.monthStart }))).ok).toBe(true);
  });
});

describe("keamanan tabel", () => {
  it("RLS aktif pada trips dan events", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname in ('trips', 'events') order by 1`,
    );
    expect(rows).toEqual([
      { relname: "events", relrowsecurity: true },
      { relname: "trips", relrowsecurity: true },
    ]);
  });

  it("tidak ada satu pun policy di schema public (kunci anon/authenticated tidak bisa apa-apa)", async () => {
    const { rows } = await db.query(`select policyname from pg_policies where schemaname = 'public'`);
    expect(rows).toEqual([]);
  });

  it("anon dan authenticated tanpa hak akses tabel; service_role punya", async () => {
    const privileges = "select, insert, update, delete";
    for (const table of ["trips", "events"]) {
      for (const role of ["anon", "authenticated"]) {
        const { rows } = await db.query<{ ok: boolean }>(
          `select (has_table_privilege('${role}', 'public.${table}', 'select')
                or has_table_privilege('${role}', 'public.${table}', 'insert')
                or has_table_privilege('${role}', 'public.${table}', 'update')
                or has_table_privilege('${role}', 'public.${table}', 'delete')) as ok`,
        );
        expect(rows[0].ok, `${role} pada ${table} (${privileges})`).toBe(false);
      }
      const { rows } = await db.query<{ ok: boolean }>(
        `select has_table_privilege('service_role', 'public.${table}', 'select, insert, update, delete') as ok`,
      );
      expect(rows[0].ok, `service_role pada ${table}`).toBe(true);
    }
  });
});

describe("tabel events", () => {
  it("hanya berisi event, jenis trip, id trip, dan waktu (tanpa data pribadi)", async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'events' order by ordinal_position`,
    );
    expect(rows.map((r) => r.column_name)).toEqual(["id", "event", "trip_type", "trip_id", "created_at"]);
  });

  it("enam nama event di database = EVENT_NAMES di kode", async () => {
    for (const name of EVENT_NAMES) {
      await db.query("insert into public.events (event) values ($1)", [name]);
    }
    await expect(db.query("insert into public.events (event) values ('lain')")).rejects.toThrow();
  });
});
