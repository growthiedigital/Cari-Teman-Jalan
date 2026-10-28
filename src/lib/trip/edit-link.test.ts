import { describe, expect, it } from "vitest";

import { editPath, editUrl, isValidEditToken } from "./edit-link";
import { generateEditToken, hashEditToken, sha256Hex } from "./secrets";

describe("link edit", () => {
  it("membangun {situs}/edit/{token}", () => {
    const token = generateEditToken();
    expect(editPath(token)).toBe(`/edit/${token}`);
    expect(editUrl("https://tripcard.id", token)).toBe(`https://tripcard.id/edit/${token}`);
  });

  it("hanya menerima token 43 karakter base64url", () => {
    expect(isValidEditToken(generateEditToken())).toBe(true);
    for (const bad of [
      "",
      "pendek",
      "a".repeat(42),
      "a".repeat(44),
      `${"a".repeat(42)}/`,
      `${"a".repeat(42)}+`,
      `${"a".repeat(42)} `,
      null,
      undefined,
      123,
    ]) {
      expect(isValidEditToken(bad), String(bad)).toBe(false);
    }
  });
});

describe("hash token", () => {
  it("SHA-256 hex dari token: 64 karakter, deterministik, dan bukan token itu sendiri", () => {
    const token = generateEditToken();
    const hash = hashEditToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(sha256Hex(token));
    expect(hashEditToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it("token yang beda satu karakter menghasilkan hash yang beda", () => {
    const token = "A".repeat(43);
    const other = `${"A".repeat(42)}B`;
    expect(hashEditToken(token)).not.toBe(hashEditToken(other));
  });
});
