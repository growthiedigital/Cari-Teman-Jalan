import { afterEach, describe, expect, it, vi } from "vitest";

import { sendEvent } from "./send-event";

afterEach(() => vi.unstubAllGlobals());

describe("sendEvent", () => {
  it("memakai sendBeacon dengan Blob application/json", async () => {
    const sendBeacon = vi.fn(() => true);
    const fetchMock = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("fetch", fetchMock);
    sendEvent({ event: "detail_viewed", tripId: "aB3dE5gH7j" });
    expect(sendBeacon).toHaveBeenCalledOnce();
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("/api/events");
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual({ event: "detail_viewed", tripId: "aB3dE5gH7j" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tanpa sendBeacon (atau ditolak) -> fetch dengan keepalive, tanpa cookie", () => {
    for (const nav of [{}, { sendBeacon: () => false }]) {
      const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
      vi.stubGlobal("navigator", nav);
      vi.stubGlobal("fetch", fetchMock);
      sendEvent({ event: "form_opened", tripType: "niat" });
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("/api/events");
      expect(init).toMatchObject({ method: "POST", keepalive: true });
      expect(init.credentials).toBeUndefined();
      expect(JSON.parse(init.body as string)).toEqual({ event: "form_opened", tripType: "niat" });
    }
  });

  it("tidak pernah melempar, juga saat fetch gagal atau sendBeacon melempar", async () => {
    vi.stubGlobal("navigator", {
      sendBeacon: () => {
        throw new Error("diblokir");
      },
    });
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    expect(() => sendEvent({ event: "link_copied", tripId: "aB3dE5gH7j" })).not.toThrow();
    await Promise.resolve();
  });
});
