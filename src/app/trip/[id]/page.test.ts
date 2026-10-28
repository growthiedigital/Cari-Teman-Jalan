import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServer, maybeSingle } = vi.hoisted(() => ({
  getSupabaseServer: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { PUBLIC_TRIP_SELECT } from "@/lib/trip/public-columns";

import TripPage, { generateMetadata } from "./page";

const ID = "aB3dE5gH7j";

function trip(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    type: "rencana",
    title: "Trip ke Labuan Bajo",
    destination: "Labuan Bajo",
    tags: ["foodie"],
    buddies_wanted: 2,
    note: null,
    budget: null,
    itinerary: "Hari 1",
    start_date: "2099-12-20",
    end_date: "2099-12-25",
    month_start: null,
    month_end: null,
    intention: null,
    creator_name: "Billy",
    is_full: false,
    ...over,
  };
}

async function render(over: Record<string, unknown> = {}) {
  maybeSingle.mockResolvedValue({ data: trip(over), error: null });
  const element = await TripPage({ params: Promise.resolve({ id: ID }) } as never);
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  maybeSingle.mockReset();
  const select = vi.fn(() => ({ eq: () => ({ maybeSingle }) }));
  getSupabaseServer.mockReset();
  getSupabaseServer.mockImplementation(() => ({ from: () => ({ select }) }));
});

describe("halaman /trip/[id]: status (database ditiru)", () => {
  it("trip normal: tautan Hubungi ke /go/{id}, tanpa penanda status", async () => {
    const html = await render();
    expect(html).toContain(`href="/go/${ID}"`);
    expect(html).toContain("Tertarik / Hubungi");
    expect(html).not.toContain("Sudah penuh");
    expect(html).not.toContain("Sudah lewat");
    expect(html).not.toContain("aria-disabled");
  });

  it("penuh: penanda 'Sudah penuh' dan tombol nonaktif tanpa href ke /go", async () => {
    const html = await render({ is_full: true });
    expect(html).toContain("Sudah penuh");
    expect(html).not.toContain("Sudah lewat");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Trip ini sudah penuh");
    expect(html).not.toContain("/go/");
    expect(html).not.toContain("Tertarik / Hubungi");
    // info trip dan footer tetap tampil
    expect(html).toContain("Trip ke Labuan Bajo");
    expect(html).toContain("Hari 1");
  });

  it("lewat (jenis rencana, tanggal pulang lampau): 'Sudah lewat' dan label lewat", async () => {
    const html = await render({ start_date: "2020-01-01", end_date: "2020-01-05" });
    expect(html).toContain("Sudah lewat");
    expect(html).not.toContain("Sudah penuh");
    expect(html).toContain("Trip ini sudah lewat");
    expect(html).not.toContain("/go/");
    expect(html).toContain('aria-disabled="true"');
  });

  it("penuh dan lewat: kedua penanda, label tombol memakai 'lewat'", async () => {
    const html = await render({ is_full: true, end_date: "2020-01-05" });
    expect(html).toContain("Sudah penuh");
    expect(html).toContain("Sudah lewat");
    expect(html).toContain("Trip ini sudah lewat");
    expect(html).not.toContain("/go/");
  });

  it("jenis niat tidak pernah 'Sudah lewat', walau bulannya lampau", async () => {
    const html = await render({
      type: "niat",
      start_date: null,
      end_date: null,
      month_start: "2020-01-01",
      month_end: "2020-03-01",
      intention: "Pengen jalan",
    });
    expect(html).not.toContain("Sudah lewat");
    expect(html).toContain(`href="/go/${ID}"`);
  });

  it("jenis niat yang penuh: 'Sudah penuh' dan tombol nonaktif", async () => {
    const html = await render({
      type: "niat",
      start_date: null,
      end_date: null,
      month_start: "2099-01-01",
      is_full: true,
    });
    expect(html).toContain("Sudah penuh");
    expect(html).not.toContain("Sudah lewat");
    expect(html).toContain("Trip ini sudah penuh");
    expect(html).not.toContain("/go/");
  });

  it("query memakai daftar kolom publik yang memuat is_full", async () => {
    await render();
    expect(PUBLIC_TRIP_SELECT.split(", ")).toContain("is_full");
  });

  it("metadata dan Open Graph tidak berubah oleh status", async () => {
    maybeSingle.mockResolvedValue({ data: trip(), error: null });
    const normal = await generateMetadata({ params: Promise.resolve({ id: ID }) } as never);
    maybeSingle.mockResolvedValue({
      data: trip({ is_full: true, end_date: "2020-01-05", start_date: "2020-01-01" }),
      error: null,
    });
    const full = await generateMetadata({ params: Promise.resolve({ id: ID }) } as never);
    // tanggal berbeda mengubah deskripsi; judul, gambar OG, dan robots tidak boleh berubah
    expect(full.title).toBe(normal.title);
    expect(full.openGraph?.images).toEqual(normal.openGraph?.images);
    expect(full.robots).toEqual(normal.robots);
    expect(JSON.stringify(full)).not.toMatch(/penuh|lewat/i);
  });
});
