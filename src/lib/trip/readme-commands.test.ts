// Memastikan perintah SQL dan contoh curl di README.md benar-benar cocok dengan
// skema dan kode. Dijalankan di Postgres tertanam (PGlite; BUKAN Supabase
// sungguhan), memakai teks yang diambil langsung dari README.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LIMITS } from "@/lib/trip/constants";
import { todayJakarta } from "@/lib/trip/dates";
import { validateTrip } from "@/lib/trip/schema";

const root = process.cwd();
const readme = readFileSync(join(root, "README.md"), "utf8");
const schema = readFileSync(join(root, "supabase/schema.sql"), "utf8");
const migrations = ["001_trips_edit_token_hash_unique.sql"].map((name) =>
  readFileSync(join(root, "supabase/migrations", name), "utf8"),
);

const sqlBlocks = [...readme.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]);
const blockWith = (needle: string) => {
  const block = sqlBlocks.find((b) => b.includes(needle));
  if (!block) throw new Error(`Blok SQL berisi "${needle}" tidak ada di README`);
  return block;
};

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  // Urutan seperti di README bagian B: schema.sql, lalu migrasi berurutan.
  await db.exec(schema);
  for (const migration of migrations) await db.exec(migration);
});

afterAll(async () => {
  await db.close();
});

async function seedTrip(id: string, startDate = "2099-06-01", endDate = "2099-06-05") {
  await db.query(
    `insert into public.trips (id, edit_token_hash, type, destination, title, creator_name,
       contact_type, contact_value, tags, start_date, end_date, creator_ip_hash, device_id)
     values ($1, $2, 'rencana', 'Labuan Bajo', 'Trip uji', 'Billy', 'whatsapp', '628123456789',
       ARRAY['foodie'], $3, $4, 'ip', 'dev')`,
    [id, `hash-${id}`, startDate, endDate],
  );
}

describe("README: urutan setup", () => {
  it("schema.sql lalu semua migrasi di folder supabase/migrations dapat dijalankan, dan boleh diulang", async () => {
    await db.exec(schema);
    for (const migration of migrations) await db.exec(migration);
    // README menyebut semua file migrasi; jangan sampai ada yang terlewat.
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(join(root, "supabase/migrations")).sort();
    expect(files).toEqual(["001_trips_edit_token_hash_unique.sql"]);
    for (const file of files) expect(readme).toContain(file);
  });
});

describe("README: variabel lingkungan", () => {
  it("setiap variabel yang dibaca kode dijelaskan di README dan ada di .env.example", () => {
    const env = readFileSync(join(root, ".env.example"), "utf8");
    for (const name of [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "IP_HASH_SALT",
      "NEXT_PUBLIC_REPORT_CONTACT",
      "NEXT_PUBLIC_SITE_URL",
    ]) {
      expect(readme, name).toContain(`\`${name}\``);
      expect(env, name).toMatch(new RegExp(`^${name}=`, "m"));
    }
  });
});

describe("README: kueri SQL", () => {
  it("uji anon: set role anon lalu select ditolak", async () => {
    const block = blockWith("set role anon");
    expect(block).toContain("select * from public.trips");
    await db.exec("set role anon");
    await expect(db.query("select * from public.trips limit 1")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });

  it("F: cek trip tidak menampilkan kontak; hapus trip mengembalikan ID-nya", async () => {
    await seedTrip("DelTrip001");
    const check = blockWith("select id, title, destination, creator_name, created_at").replace(
      /ID_TRIP/g,
      "DelTrip001",
    );
    const { rows } = await db.query<Record<string, unknown>>(check);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0])).not.toContain("contact_value");
    expect(Object.keys(rows[0])).not.toContain("edit_token_hash");

    const del = blockWith("delete from public.trips where id = 'ID_TRIP' returning id").replace(
      /ID_TRIP/g,
      "DelTrip001",
    );
    const deleted = await db.query<{ id: string }>(del);
    expect(deleted.rows).toEqual([{ id: "DelTrip001" }]);
    const again = await db.query<{ id: string }>(del);
    expect(again.rows).toEqual([]);
  });

  it("F: hapus baris events untuk trip itu", async () => {
    await db.query("insert into public.events (event, trip_id) values ('link_copied', 'DelTrip002')");
    const stmt = /`(delete from public\.events where trip_id = 'ID_TRIP';)`/.exec(readme)?.[1];
    expect(stmt).toBeDefined();
    await db.exec((stmt as string).replace("ID_TRIP", "DelTrip002"));
    const { rows } = await db.query("select 1 from public.events where trip_id = 'DelTrip002'");
    expect(rows).toEqual([]);
  });

  it("G: ubah ke 'sudah lewat' lalu kembalikan tanggal asli", async () => {
    await seedTrip("Lewat00001", "2099-06-01", "2099-06-05");
    const block = blockWith("jadikan sudah lewat").replace(/ID_TRIP_UJI/g, "Lewat00001");
    const [catat, jadikan, kembalikan] = block
      .split(/^--.*$/m)
      .map((part) => part.trim())
      .filter(Boolean);

    const before = await db.query<{ start_date: Date; end_date: Date }>(catat);
    expect(before.rows).toHaveLength(1);

    await db.exec(jadikan);
    const { rows } = await db.query<{ end_date: Date }>(
      "select end_date from public.trips where id = 'Lewat00001'",
    );
    const endDate = rows[0].end_date.toISOString().slice(0, 10);
    // Kemarin menurut Jakarta = sudah lewat menurut aturan status.
    expect(endDate < todayJakarta()).toBe(true);

    await db.exec(kembalikan.replace(/'YYYY-MM-DD'/g, "'2099-06-01'"));
    const restored = await db.query<{ start_date: Date }>(
      "select start_date from public.trips where id = 'Lewat00001'",
    );
    expect(restored.rows[0].start_date.toISOString().slice(0, 10)).toBe("2099-06-01");
  });

  it("H: setiap kueri metrik yang disebut README ada di file metrik-sukses.sql", () => {
    const sql = readFileSync(join(root, "supabase/queries/metrik-sukses.sql"), "utf8");
    for (const n of [1, 2, 3, 4, 5]) expect(sql).toContain(`-- KUERI ${n}:`);
    for (const column of [
      "persen_selesai_form",
      "persen_diunduh_atau_disalin",
      "persen_dengan_klik_hubungi",
      "1_persen_selesai_form",
      "2_persen_diunduh_atau_disalin",
      "3_persen_dengan_klik_hubungi",
    ]) {
      expect(sql, column).toContain(column);
      expect(readme, column).toContain(column);
    }
  });
});

describe("README: contoh curl validasi", () => {
  it("body contoh gagal tepat pada tujuan terlalu panjang dan tanggal pulang sebelum berangkat", () => {
    const body = /-d '(\{"type":"rencana"[^']*\})'/.exec(readme)?.[1];
    expect(body).toBeDefined();
    const result = validateTrip(JSON.parse(body as string));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["destination", "endDate"]);
    expect(result.errors.destination).toContain(String(LIMITS.destination));
  });
});
