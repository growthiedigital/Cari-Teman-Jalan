import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

describe("header untuk /edit/:path*", () => {
  it("no-store, noindex+nofollow, dan Referrer-Policy: no-referrer", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const rule = rules.find((r) => r.source === "/edit/:path*");
    expect(rule).toBeDefined();
    const headers = Object.fromEntries((rule?.headers ?? []).map((h) => [h.key, h.value]));
    expect(headers["Cache-Control"]).toBe("no-store");
    expect(headers["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });
});
