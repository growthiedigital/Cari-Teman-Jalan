import { beforeEach, describe, expect, it, vi } from "vitest";

const { maybeSingle, eq, select, from, getSupabaseServer } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getSupabaseServer = vi.fn(() => ({ from }));
  return { maybeSingle, eq, select, from, getSupabaseServer };
});

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));

import { getPublicTrip, getTripContact } from "./queries";
import { PUBLIC_TRIP_SELECT } from "./public-columns";

const ID = "aB3dE5gH7j";

beforeEach(() => {
  maybeSingle.mockReset();
  eq.mockClear();
  select.mockClear();
  from.mockClear();
  getSupabaseServer.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getPublicTrip", () => {
  it("ID tidak valid -> null tanpa menyentuh database", async () => {
    expect(await getPublicTrip("ngawur")).toBeNull();
    expect(await getPublicTrip("../../etc/x")).toBeNull();
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });

  it("memakai daftar kolom eksplisit", async () => {
    maybeSingle.mockResolvedValue({ data: { id: ID }, error: null });
    await getPublicTrip(ID);
    expect(from).toHaveBeenCalledWith("trips");
    expect(select).toHaveBeenCalledWith(PUBLIC_TRIP_SELECT);
    expect(eq).toHaveBeenCalledWith("id", ID);
  });

  it("trip tidak ada -> null; error database dilempar", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await getPublicTrip(ID)).toBeNull();
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    await expect(getPublicTrip(ID)).rejects.toThrow();
  });
});

describe("getTripContact", () => {
  it("hanya membaca kolom kontak dan kolom status", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        contact_type: "whatsapp",
        contact_value: "6281234567890",
        is_full: true,
        type: "rencana",
        end_date: "2026-12-25",
      },
      error: null,
    });
    expect(await getTripContact(ID)).toEqual({
      contactType: "whatsapp",
      contactValue: "6281234567890",
      isFull: true,
      type: "rencana",
      endDate: "2026-12-25",
    });
    expect(select).toHaveBeenCalledWith(
      "contact_type, contact_value, is_full, type, end_date",
    );
  });

  it("ID tidak valid -> null tanpa menyentuh database", async () => {
    expect(await getTripContact("x")).toBeNull();
    expect(getSupabaseServer).not.toHaveBeenCalled();
  });
});
