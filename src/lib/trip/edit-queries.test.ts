import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../../test/fake-supabase";

const { getSupabaseServer } = vi.hoisted(() => ({ getSupabaseServer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));

import { EDIT_READ_SELECT } from "./edit-columns";
import { findTripByToken } from "./edit-queries";
import { generateEditToken } from "./secrets";

describe("findTripByToken (pencarian lewat hash token)", () => {
  const token = generateEditToken();
  const hash = createHash("sha256").update(token).digest("hex");
  let db: ReturnType<typeof createFakeDb>;

  beforeEach(() => {
    db = createFakeDb([
      { id: "aB3dE5gH7j", type: "niat", edit_token_hash: hash, destination: "Bali", contact_value: "x" },
    ]);
    getSupabaseServer.mockReset();
    getSupabaseServer.mockImplementation(() => db.client);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("mencocokkan SHA-256 token dengan edit_token_hash dan memakai daftar kolom eksplisit", async () => {
    const row = await findTripByToken(token);
    expect(row).toMatchObject({ id: "aB3dE5gH7j", destination: "Bali" });
    expect(db.log.selects[0]).toEqual({
      columns: EDIT_READ_SELECT,
      filters: [["edit_token_hash", hash]],
    });
    expect(row).not.toHaveProperty("edit_token_hash");
  });

  it("token salah satu karakter -> null", async () => {
    const wrong = `${token.slice(0, 42)}${token.endsWith("A") ? "B" : "A"}`;
    expect(await findTripByToken(wrong)).toBeNull();
  });

  it("token bentuk salah -> null tanpa menyentuh database", async () => {
    for (const bad of ["", "pendek", null, undefined, 5, `${token}x`]) {
      expect(await findTripByToken(bad)).toBeNull();
    }
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("galat database dilempar, bukan dianggap tidak ditemukan; pesan tanpa token", async () => {
    db = createFakeDb([], { error: { code: "XX000" } });
    await expect(findTripByToken(token)).rejects.toThrow(/^Gagal memuat trip\.$/);
  });
});
