/**
 * Tiruan kecil klien Supabase untuk uji alur (BUKAN database sungguhan): satu
 * tabel dalam memori dengan rantai select/update/delete + eq + maybeSingle,
 * seperti yang dipakai kode aplikasi. Select hanya mengembalikan kolom yang
 * diminta, dan semua pemanggilan dicatat supaya uji bisa memeriksanya.
 */
export type FakeRow = Record<string, unknown>;

export type FakeDbOptions = {
  /** Bila diisi, setiap query mengembalikan error ini (mis. { code: "XX000" }). */
  error?: { code: string };
};

type Filter = [column: string, value: unknown];

export function createFakeDb(initial: FakeRow[], options: FakeDbOptions = {}) {
  const rows: FakeRow[] = initial.map((r) => structuredClone(r));
  const log = {
    selects: [] as { columns: string; filters: Filter[] }[],
    updates: [] as { patch: FakeRow; filters: Filter[] }[],
    deletes: [] as { filters: Filter[] }[],
    tables: [] as string[],
  };

  function project(row: FakeRow, columns: string): FakeRow {
    const out: FakeRow = {};
    for (const c of columns.split(",").map((x) => x.trim())) out[c] = structuredClone(row[c]);
    return out;
  }

  function builder(kind: "select" | "update" | "delete", columns: string, patch?: FakeRow) {
    const filters: Filter[] = [];
    let returning: string | null = kind === "select" ? columns : null;

    const run = () => {
      if (options.error) return { data: null, error: options.error };
      const matched = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      if (kind === "select") {
        log.selects.push({ columns: columns, filters: [...filters] });
        return { data: matched.map((r) => project(r, columns)), error: null };
      }
      if (kind === "update") {
        log.updates.push({ patch: structuredClone(patch as FakeRow), filters: [...filters] });
        for (const r of matched) Object.assign(r, patch);
      } else {
        log.deletes.push({ filters: [...filters] });
        for (const r of matched) rows.splice(rows.indexOf(r), 1);
      }
      return {
        data: returning ? matched.map((r) => project(r, returning as string)) : null,
        error: null,
      };
    };

    const self = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return self;
      },
      select(cols: string) {
        returning = cols;
        return self;
      },
      maybeSingle() {
        const { data, error } = run();
        const list = (data as FakeRow[] | null) ?? [];
        return Promise.resolve({ data: list[0] ?? null, error });
      },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return self;
  }

  const client = {
    from(table: string) {
      log.tables.push(table);
      return {
        select: (columns: string) => builder("select", columns),
        update: (patch: FakeRow) => builder("update", "", patch),
        delete: () => builder("delete", ""),
      };
    },
  };

  return { client, rows, log };
}
