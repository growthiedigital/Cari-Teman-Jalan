import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type Group = { agents: string[]; disallow: string[]; allow: string[] };

/** Urai robots.txt menjadi grup per User-agent (cukup untuk berkas sederhana ini). */
function parseRobots(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    const match = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2];
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current && key === "disallow") current.disallow.push(value);
    if (current && key === "allow") current.allow.push(value);
  }
  return groups;
}

const groups = parseRobots(readFileSync(join(process.cwd(), "public", "robots.txt"), "utf8"));
const star = groups.find((g) => g.agents.includes("*"));

describe("robots.txt", () => {
  it("tidak melarang /api/card/ untuk siapa pun (dibutuhkan crawler pratinjau link)", () => {
    for (const group of groups) {
      expect(group.disallow.some((path) => path && "/api/card/x".startsWith(path))).toBe(false);
    }
  });

  it("aturan umum: /go/ dan /trip/ tetap dilarang", () => {
    expect(star?.disallow).toEqual(expect.arrayContaining(["/go/", "/trip/"]));
  });

  it("/edit/ (link rahasia) dilarang untuk semua, termasuk crawler pratinjau", () => {
    expect(star?.disallow).toContain("/edit/");
    for (const group of groups) {
      expect(group.disallow, group.agents.join(",")).toContain("/edit/");
      expect(group.allow.some((path) => path && "/edit/x".startsWith(path))).toBe(false);
    }
  });

  it("crawler pratinjau (WhatsApp, Meta) boleh membaca /trip/ tetapi tidak /go/", () => {
    for (const agent of ["facebookexternalhit", "meta-externalagent", "whatsapp"]) {
      const group = groups.find((g) => g.agents.includes(agent));
      expect(group, agent).toBeDefined();
      expect(group?.allow).toContain("/trip/");
      expect(group?.disallow).toContain("/go/");
      expect(group?.disallow).not.toContain("/trip/");
    }
  });
});
