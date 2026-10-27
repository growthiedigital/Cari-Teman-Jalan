import { NextResponse } from "next/server";

import { buildContactUrl } from "@/lib/trip/contact-url";
import { getTripContact } from "@/lib/trip/queries";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
};

function plain(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Tombol "Tertarik / Hubungi": kontak hanya dibaca di sini, di server, lalu
 * dialihkan (302) ke WhatsApp/Instagram. Nomor/handle tidak pernah ada di HTML
 * halaman trip.
 */
export async function GET(_request: Request, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;

  let contact: Awaited<ReturnType<typeof getTripContact>>;
  try {
    contact = await getTripContact(id);
  } catch {
    return plain("Terjadi kesalahan di server. Coba lagi beberapa saat lagi.", 500);
  }

  const url = contact && buildContactUrl(contact.contactType, contact.contactValue);
  if (!contact || !url) return plain("Trip tidak ditemukan atau sudah dihapus.", 404);

  // Tahap 6: catat event `contact_clicked` di sini (satu-satunya titik
  // penambahan), sebelum redirect. Jangan menahan redirect bila gagal.

  return NextResponse.redirect(url, { status: 302, headers: HEADERS });
}
