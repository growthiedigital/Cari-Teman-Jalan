/**
 * Tiruan kecil klien Supabase untuk uji alur (BUKAN database sungguhan): satu
 * tabel dalam memori dengan rantai select/insert/update/delete + eq/gte/order/
 * limit + maybeSingle, seperti yang dipakai kode aplikasi. (Nama tabel hanya
 * dicatat di `log.tables`; semua tabel berbagi satu daftar baris.) Select hanya mengembalikan kolom yang
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
    inserts: [] as { table: string; row: FakeRow }[],
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
    const minimums: Filter[] = [];
    let orderBy: { column: string; ascending: boolean } | null = null;
    let max = Infinity;
    let returning: string | null = kind === "select" ? columns : null;

    const run = () => {
      if (options.error) return { data: null, error: options.error };
      let matched = rows.filter(
        (r) =>
          filters.every(([c, v]) => r[c] === v) &&
          minimums.every(([c, v]) => String(r[c]) >= String(v)),
      );
      if (orderBy) {
        const { column, ascending } = orderBy;
        matched = [...matched].sort((a, b) =>
          String(a[column]) < String(b[column]) ? (ascending ? -1 : 1) : ascending ? 1 : -1,
        );
      }
      matched = matched.slice(0, max);
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
      gte(column: string, value: unknown) {
        minimums.push([column, value]);
        return self;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        orderBy = { column, ascending: opts?.ascending ?? true };
        return self;
      },
      limit(count: number) {
        max = count;
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
        insert: (row: FakeRow) => {
          log.inserts.push({ table, row: structuredClone(row) });
          if (options.error) return Promise.resolve({ error: options.error });
          rows.push(structuredClone(row));
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return { client, rows, log };
}
