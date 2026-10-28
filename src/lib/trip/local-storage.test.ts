import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MY_TRIPS_KEY,
  findEditToken,
  hasMyTripWithToken,
  parseMyTrips,
  readMyTrips,
  removeMyTrip,
  removeMyTripByToken,
  saveMyTrip,
  saveSessionBackup,
  updateMyTripTitle,
  type MyTrip,
} from "./local-storage";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

/** Storage yang melempar galat di setiap akses (mode privat / diblokir). */
function brokenStorage() {
  const boom = () => {
    throw new Error("SecurityError");
  };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

const TOKEN_A = "A".repeat(43);
const TOKEN_B = "B".repeat(43);
const trip = (over: Partial<MyTrip> = {}): MyTrip => ({
  id: "aB3dE5gH7j",
  editToken: TOKEN_A,
  title: "Trip ke Bali",
  createdAt: "2026-12-15T03:00:00.000Z",
  ...over,
});

let local: ReturnType<typeof fakeStorage>;
let session: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  local = fakeStorage();
  session = fakeStorage();
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
});
afterEach(() => vi.unstubAllGlobals());

describe("daftar tripcard:mytrips", () => {
  it("kosong bila belum ada apa pun", () => {
    expect(readMyTrips()).toEqual([]);
  });

  it("tambah dan baca", () => {
    saveMyTrip(trip());
    saveMyTrip(trip({ id: "zZ9yY8xX7w", editToken: TOKEN_B, title: "Trip ke Lombok" }));
    expect(readMyTrips().map((t) => t.id)).toEqual(["aB3dE5gH7j", "zZ9yY8xX7w"]);
    expect(JSON.parse(local.data.get(MY_TRIPS_KEY) as string)).toHaveLength(2);
  });

  it("menyimpan id yang sama dua kali menggantikan, bukan menggandakan", () => {
    saveMyTrip(trip());
    saveMyTrip(trip({ title: "Judul baru" }));
    expect(readMyTrips()).toEqual([trip({ title: "Judul baru" })]);
  });

  it("hapus berdasarkan id dan berdasarkan token", () => {
    saveMyTrip(trip());
    saveMyTrip(trip({ id: "zZ9yY8xX7w", editToken: TOKEN_B }));
    expect(hasMyTripWithToken(TOKEN_B)).toBe(true);
    removeMyTrip("aB3dE5gH7j");
    expect(readMyTrips().map((t) => t.id)).toEqual(["zZ9yY8xX7w"]);
    removeMyTripByToken(TOKEN_B);
    expect(readMyTrips()).toEqual([]);
    expect(hasMyTripWithToken(TOKEN_B)).toBe(false);
  });

  it("menghapus entri yang tidak ada tidak mengubah apa pun", () => {
    saveMyTrip(trip());
    removeMyTrip("tidakada00");
    removeMyTripByToken("X".repeat(43));
    expect(readMyTrips()).toEqual([trip()]);
  });

  it("ubah judul hanya untuk id yang cocok", () => {
    saveMyTrip(trip());
    saveMyTrip(trip({ id: "zZ9yY8xX7w", editToken: TOKEN_B }));
    updateMyTripTitle("aB3dE5gH7j", "Judul baru");
    const [a, b] = readMyTrips();
    expect(a.title).toBe("Judul baru");
    expect(b.title).toBe("Trip ke Bali");
    expect(a.editToken).toBe(TOKEN_A);
    updateMyTripTitle("tidakada00", "x"); // tidak melempar
  });
});

describe("JSON rusak dan storage bermasalah", () => {
  it("JSON rusak -> kosong, tidak melempar, dan bisa ditimpa entri baru", () => {
    local.setItem(MY_TRIPS_KEY, "{rusak");
    expect(readMyTrips()).toEqual([]);
    saveMyTrip(trip());
    expect(readMyTrips()).toEqual([trip()]);
  });

  it("bukan larik, atau entri berbentuk salah -> dibuang", () => {
    expect(parseMyTrips('{"a":1}')).toEqual([]);
    expect(parseMyTrips("null")).toEqual([]);
    expect(parseMyTrips(null)).toEqual([]);
    expect(parseMyTrips("")).toEqual([]);
    const mixed = JSON.stringify([trip(), { id: 1 }, null, "x", { ...trip(), editToken: 5 }]);
    expect(parseMyTrips(mixed)).toEqual([trip()]);
  });

  it("storage melempar galat -> semua fungsi diam-diam tidak melakukan apa-apa", () => {
    vi.stubGlobal("localStorage", brokenStorage());
    vi.stubGlobal("sessionStorage", brokenStorage());
    expect(readMyTrips()).toEqual([]);
    expect(() => saveMyTrip(trip())).not.toThrow();
    expect(() => removeMyTrip("aB3dE5gH7j")).not.toThrow();
    expect(() => removeMyTripByToken(TOKEN_A)).not.toThrow();
    expect(() => updateMyTripTitle("aB3dE5gH7j", "x")).not.toThrow();
    expect(() => saveSessionBackup({ id: "aB3dE5gH7j", editToken: TOKEN_A })).not.toThrow();
    expect(hasMyTripWithToken(TOKEN_A)).toBe(false);
    expect(findEditToken("aB3dE5gH7j")).toBeNull();
  });
});

describe("findEditToken (localStorage, lalu cadangan sessionStorage)", () => {
  it("memakai localStorage bila ada", () => {
    saveMyTrip(trip());
    saveSessionBackup({ id: "aB3dE5gH7j", editToken: TOKEN_B });
    expect(findEditToken("aB3dE5gH7j")).toBe(TOKEN_A);
  });

  it("localStorage gagal -> cadangan sessionStorage", () => {
    saveSessionBackup({ id: "aB3dE5gH7j", editToken: TOKEN_B });
    vi.stubGlobal("localStorage", brokenStorage());
    expect(findEditToken("aB3dE5gH7j")).toBe(TOKEN_B);
  });

  it("cadangan untuk trip lain tidak dipakai; keduanya kosong -> null", () => {
    saveSessionBackup({ id: "zZ9yY8xX7w", editToken: TOKEN_B });
    expect(findEditToken("aB3dE5gH7j")).toBeNull();
    session.setItem("tripcard:lastcreated", "{rusak");
    expect(findEditToken("aB3dE5gH7j")).toBeNull();
  });

  it("cadangan hanya memuat id dan token", () => {
    saveSessionBackup({ id: "aB3dE5gH7j", editToken: TOKEN_A });
    const stored = JSON.parse(session.data.get("tripcard:lastcreated") as string);
    expect(Object.keys(stored).sort()).toEqual(["editToken", "id"]);
  });
});
