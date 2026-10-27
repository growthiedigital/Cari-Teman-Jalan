import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTripContact } = vi.hoisted(() => ({ getTripContact: vi.fn() }));
vi.mock("@/lib/trip/queries", () => ({ getTripContact }));

import { GET } from "./route";

const ID = "aB3dE5gH7j";
const call = (id: string) =>
  GET(new Request(`http://localhost/go/${id}`), {
    params: Promise.resolve({ id }),
  } as never);

beforeEach(() => {
  getTripContact.mockReset();
});

describe("GET /go/[id]", () => {
  it("WhatsApp -> 302 ke wa.me dengan header no-store dan noindex", async () => {
    getTripContact.mockResolvedValue({ contactType: "whatsapp", contactValue: "6281234567890" });
    const res = await call(ID);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://wa.me/6281234567890");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("Instagram -> 302 ke instagram.com", async () => {
    getTripContact.mockResolvedValue({ contactType: "instagram", contactValue: "billy.trip" });
    const res = await call(ID);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://instagram.com/billy.trip");
  });

  it("trip tidak ada atau kontak rusak -> 404", async () => {
    getTripContact.mockResolvedValueOnce(null);
    const missing = await call(ID);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    getTripContact.mockResolvedValueOnce({ contactType: "whatsapp", contactValue: "abc" });
    expect((await call(ID)).status).toBe(404);
  });

  it("error database -> 500 tanpa membocorkan detail", async () => {
    getTripContact.mockRejectedValue(new Error("rahasia internal"));
    const res = await call(ID);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("rahasia");
  });
});
