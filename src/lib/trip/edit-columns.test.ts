import { describe, expect, it } from "vitest";

import { upcomingMonths, withStoredMonths } from "./dates";
import {
  EDITABLE_COLUMNS,
  EDIT_READ_COLUMNS,
  NON_EDITABLE_COLUMNS,
  buildEditPatch,
  type EditableTripRow,
} from "./edit-columns";
import { tripRowToFormValues } from "./form-values";
import { PUBLIC_TRIP_COLUMNS, PUBLIC_TRIP_SELECT } from "./public-columns";
import { validateTripEdit } from "./schema";

const ROW: EditableTripRow = {
  id: "aB3dE5gH7j",
  type: "rencana",
  destination: "Labuan Bajo",
  title: "Trip ke Labuan Bajo",
  creator_name: "Billy",
  contact_type: "whatsapp",
  contact_value: "6281234567890",
  tags: ["foodie", "alam"],
  buddies_wanted: 3,
  note: null,
  budget: 1_500_000,
  itinerary: "Hari 1",
  start_date: "2026-12-20",
  end_date: "2026-12-25",
  month_start: null,
  month_end: null,
  intention: null,
  is_full: false,
};

describe("kolom yang di-UPDATE", () => {
  it("tidak memuat satu pun kolom terlarang", () => {
    for (const forbidden of NON_EDITABLE_COLUMNS) {
      expect(EDITABLE_COLUMNS as readonly string[]).not.toContain(forbidden);
    }
  });

  it("terlarang: hash token, hash IP, device id, snapshot, tema, is_full, id, jenis", () => {
    for (const c of [
      "edit_token_hash", "creator_ip_hash", "device_id", "card_snapshot",
      "theme", "is_full", "id", "type", "created_at", "updated_at",
    ]) {
      expect(NON_EDITABLE_COLUMNS as readonly string[]).toContain(c);
    }
  });

  it("isi patch persis sama dengan daftar kolom yang boleh diedit", () => {
    const result = validateTripEdit(
      tripRowToFormValues(ROW),
      {
        type: "rencana",
        startDate: ROW.start_date,
        endDate: ROW.end_date,
        monthStart: null,
        monthEnd: null,
      },
      new Date("2026-12-15T03:00:00Z"),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const patch = buildEditPatch(result.data);
    expect(Object.keys(patch).sort()).toEqual([...EDITABLE_COLUMNS].sort());
    for (const forbidden of NON_EDITABLE_COLUMNS) expect(patch).not.toHaveProperty(forbidden);
  });

  it("kolom baca untuk halaman edit hanya id, type, kolom yang boleh diedit, dan is_full (tanpa hash/ip/device/snapshot)", () => {
    expect([...EDIT_READ_COLUMNS].sort()).toEqual(
      ["id", "type", ...EDITABLE_COLUMNS, "is_full"].sort(),
    );
    expect(EDITABLE_COLUMNS as readonly string[]).not.toContain("is_full");
    for (const c of ["edit_token_hash", "creator_ip_hash", "device_id", "card_snapshot", "theme"]) {
      expect(EDIT_READ_COLUMNS as readonly string[]).not.toContain(c);
    }
  });
});

describe("kolom halaman publik Tahap 2 tetap tanpa kontak", () => {
  it("PUBLIC_TRIP_COLUMNS tidak memuat contact_* maupun kolom rahasia", () => {
    for (const c of PUBLIC_TRIP_COLUMNS) {
      expect(c.startsWith("contact_")).toBe(false);
      expect(["edit_token_hash", "creator_ip_hash", "device_id", "card_snapshot"]).not.toContain(c);
    }
    expect(PUBLIC_TRIP_SELECT).not.toMatch(/contact|token|hash|device|snapshot/);
  });

  it("Tahap 5: memuat is_full (satu-satunya tambahan), plus type dan end_date untuk status", () => {
    expect(PUBLIC_TRIP_COLUMNS).toContain("is_full");
    expect(PUBLIC_TRIP_COLUMNS).toContain("type");
    expect(PUBLIC_TRIP_COLUMNS).toContain("end_date");
    expect(PUBLIC_TRIP_SELECT.split(", ")).toEqual([...PUBLIC_TRIP_COLUMNS]);
  });
});

describe("tripRowToFormValues", () => {
  it("mengubah baris DB menjadi isian teks, null menjadi kosong", () => {
    expect(tripRowToFormValues(ROW)).toEqual({
      destination: "Labuan Bajo",
      title: "Trip ke Labuan Bajo",
      creatorName: "Billy",
      tags: ["foodie", "alam"],
      buddiesWanted: "3",
      note: "",
      budget: "1500000",
      contactType: "whatsapp",
      contactValue: "6281234567890",
      startDate: "2026-12-20",
      endDate: "2026-12-25",
      itinerary: "Hari 1",
      monthStart: "",
      monthEnd: "",
      intention: "",
    });
  });
});

describe("withStoredMonths", () => {
  const now = new Date("2026-12-15T03:00:00Z");
  it("menambahkan bulan lampau tersimpan, terurut, tanpa duplikat", () => {
    const out = withStoredMonths(upcomingMonths(now, 3), ["2026-10-01", "2026-10-01", "2027-01-01", null]);
    expect(out.map((o) => o.value)).toEqual([
      "2026-10-01", "2026-12-01", "2027-01-01", "2027-02-01",
    ]);
    expect(out[0].label).toBe("Oktober 2026");
  });
});
