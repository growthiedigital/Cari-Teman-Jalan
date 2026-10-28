import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusSection } from "./status-section";

const render = (initialIsFull: boolean, expired: boolean) =>
  renderToStaticMarkup(
    createElement(StatusSection, { token: "T".repeat(43), initialIsFull, expired }),
  );

describe("StatusSection (render awal)", () => {
  it("belum penuh: tombol 'Tandai sudah penuh', tanpa keterangan lewat", () => {
    const html = render(false, false);
    expect(html).toContain("Status trip");
    expect(html).toContain("Masih cari teman");
    expect(html).toContain("Tandai sudah penuh");
    expect(html).not.toContain("Buka lagi");
    expect(html).not.toContain("sudah lewat");
  });

  it("sudah penuh: tombol 'Buka lagi, masih cari teman'", () => {
    const html = render(true, false);
    expect(html).toContain("Sudah penuh");
    expect(html).toContain("Buka lagi, masih cari teman");
    expect(html).not.toContain("Tandai sudah penuh");
  });

  it("kedaluwarsa: keterangan informatif, bukan tombol untuk mematikannya", () => {
    const html = render(false, true);
    expect(html).toContain("Trip ini sudah lewat karena tanggal pulang sudah berlalu");
    expect(html).toContain("Tandai sudah penuh");
    expect(html).not.toContain("Masih cari teman");
    expect((html.match(/<button/g) ?? []).length).toBe(1);
  });
});
