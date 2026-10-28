// Pagar regresi dari audit Tahap 7: pemeriksaan statis atas kode sumber agar
// pelanggaran prinsip akses/keamanan (kontak, token, kunci rahasia) tertangkap
// saat uji, bukan saat produksi. Semua berkas di src/ selain berkas uji.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = walk(SRC).map((path) => ({
  path: relative(process.cwd(), path).split("\\").join("/"),
  text: readFileSync(path, "utf8"),
}));

const withText = (pattern: RegExp) =>
  files.filter((f) => pattern.test(f.text)).map((f) => f.path).sort();

describe("kontak pembuat", () => {
  it("kolom contact_type/contact_value hanya disebut di berkas yang memang perlu", () => {
    expect(withText(/contact_(type|value)/)).toEqual([
      "src/app/api/trips/route.ts", // insert trip baru
      "src/lib/trip/edit-columns.ts", // baca/tulis lewat token edit
      "src/lib/trip/form-values.ts", // isian awal form edit (baris dari token edit)
      "src/lib/trip/public-columns.ts", // daftar kolom /go (CONTACT_COLUMNS)
      "src/lib/trip/queries.ts", // getTripContact, hanya untuk /go
    ]);
  });

  it("getTripContact hanya dipakai route /go/[id]", () => {
    const users = files.filter((f) => /\bgetTripContact\b/.test(f.text)).map((f) => f.path);
    expect(users.sort()).toEqual(["src/app/go/[id]/route.ts", "src/lib/trip/queries.ts"]);
  });

  it("findTripByToken (membaca kontak) hanya dipakai halaman edit dan endpoint edit", () => {
    const users = files.filter((f) => /\bfindTripByToken\b/.test(f.text)).map((f) => f.path);
    expect(users.sort()).toEqual([
      "src/app/api/trips/edit/route.ts",
      "src/app/edit/[token]/page.tsx",
      "src/lib/trip/edit-queries.ts",
    ]);
  });

  it("kolom publik tidak memuat kontak, hash, atau data perangkat", () => {
    const text = files.find((f) => f.path === "src/lib/trip/public-columns.ts")?.text ?? "";
    const block = /PUBLIC_TRIP_COLUMNS = \[([\s\S]*?)\] as const/.exec(text)?.[1] ?? "";
    expect(block).not.toMatch(/contact|hash|device|snapshot|token/);
  });
});

describe("query database", () => {
  it('tidak ada select("*") maupun .select() kosong pada query Supabase', () => {
    const offenders = files
      .filter((f) => f.path !== "src/lib/copy-text.ts") // .select() DOM, bukan Supabase
      .filter((f) => /\.select\(\s*(["'`]\*["'`])?\s*\)/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe("kunci rahasia dan variabel lingkungan", () => {
  it("klien Supabase memakai server-only dan service role; tidak ada kunci anon", () => {
    const server = files.find((f) => f.path === "src/lib/supabase/server.ts")?.text ?? "";
    expect(server).toMatch(/^import "server-only";/m);
    expect(server).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(withText(/anon|publishable|NEXT_PUBLIC_SUPABASE/i)).toEqual([]);
  });

  it("hanya dua variabel NEXT_PUBLIC_ (keduanya publik): REPORT_CONTACT dan SITE_URL", () => {
    const names = new Set<string>();
    for (const f of files) {
      for (const m of f.text.matchAll(/NEXT_PUBLIC_[A-Z_]+/g)) names.add(m[0]);
    }
    expect([...names].sort()).toEqual(["NEXT_PUBLIC_REPORT_CONTACT", "NEXT_PUBLIC_SITE_URL"]);
  });

  it("variabel rahasia hanya dibaca di modul server-only", () => {
    for (const f of files.filter((x) => /SUPABASE_SERVICE_ROLE_KEY|IP_HASH_SALT/.test(x.text))) {
      expect(f.text, f.path).toMatch(/^import "server-only";/m);
    }
  });

  it("berkas klien ('use client') tidak membaca process.env", () => {
    const offenders = files
      .filter((f) => /^"use client";/m.test(f.text) && /process\.env/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe("keluaran dan log", () => {
  it("tidak ada dangerouslySetInnerHTML", () => {
    expect(withText(/dangerouslySetInnerHTML|\.innerHTML\s*=/)).toEqual([]);
  });

  it("console.* tidak pernah mencatat token, kontak, body, header, atau objek error utuh", () => {
    const calls: string[] = [];
    for (const f of files) {
      for (const m of f.text.matchAll(/console\.\w+\(([\s\S]*?)\);/g)) {
        calls.push(`${f.path}: ${m[1]}`);
      }
    }
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      // Label di awal (mis. "[findTripByToken] ...") boleh menyebut kata apa pun;
      // yang diperiksa adalah argumen setelahnya.
      const args = call.replace(/^[^:]+: *(["'`])(?:(?!\1).)*\1,? */, "");
      expect(args).not.toMatch(/token|contact|body|headers|request|\bhash/i);
      // Hanya objek berisi kode/nama kasar; bukan `error` apa adanya.
      expect(args).not.toMatch(/^error$/);
    }
  });
});

describe("endpoint penulisan", () => {
  it("setiap route yang menulis memvalidasi sebelum menyentuh database", () => {
    const expectations: [string, RegExp][] = [
      ["src/app/api/trips/route.ts", /validateTrip\(/],
      ["src/app/api/trips/edit/route.ts", /validateTripEdit\(/],
      ["src/app/api/trips/status/route.ts", /typeof isFull !== "boolean"/],
      ["src/app/api/trips/delete/route.ts", /isValidEditToken\(/],
      ["src/app/api/card/preview/route.ts", /validateTrip\(/],
      ["src/app/api/events/route.ts", /isClientEventName\(/],
    ];
    for (const [path, pattern] of expectations) {
      const text = files.find((f) => f.path === path)?.text ?? "";
      expect(text, path).toMatch(pattern);
    }
  });

  it("tidak ada route penulisan lain selain yang diinventaris (POST di app/api)", () => {
    const posts = files
      .filter((f) => f.path.startsWith("src/app/") && /export (async )?function POST\b/.test(f.text))
      .map((f) => f.path);
    expect(posts.sort()).toEqual([
      "src/app/api/card/preview/route.ts",
      "src/app/api/events/route.ts",
      "src/app/api/trips/delete/route.ts",
      "src/app/api/trips/edit/route.ts",
      "src/app/api/trips/route.ts",
      "src/app/api/trips/status/route.ts",
    ]);
  });

  it("tidak ada route yang mengembalikan banyak trip (tidak ada daftar/pencarian)", () => {
    // Setiap query ke trips memakai .eq("id"|"edit_token_hash"|kolom batas) atau .limit(1).
    const text = files.find((f) => f.path === "src/lib/trip/queries.ts")?.text ?? "";
    const selects = [...text.matchAll(/\.from\("trips"\)[\s\S]*?\.maybeSingle\(\)/g)];
    expect(selects.length).toBe(3);
  });
});
