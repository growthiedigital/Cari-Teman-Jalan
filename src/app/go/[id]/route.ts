import { NextResponse } from "next/server";

import { isBot } from "@/lib/analytics/is-bot";
import { isPrefetchRequest } from "@/lib/analytics/is-prefetch";
import { recordEventAfter } from "@/lib/analytics/record-event";
import { buildContactUrl } from "@/lib/trip/contact-url";
import { getTripContact } from "@/lib/trip/queries";
import { tripStatus } from "@/lib/trip/status";

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
 * halaman trip. Trip "Sudah penuh" atau "Sudah lewat" TIDAK diarahkan ke
 * kontak (tautan lama, cache, atau URL yang disalin tidak boleh melewati
 * tombol nonaktif): dialihkan kembali ke halaman detail.
 */
export async function GET(request: Request, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;

  let contact: Awaited<ReturnType<typeof getTripContact>>;
  try {
    contact = await getTripContact(id);
  } catch {
    return plain("Terjadi kesalahan di server. Coba lagi beberapa saat lagi.", 500);
  }

  if (!contact) return plain("Trip tidak ditemukan atau sudah dihapus.", 404);

  const status = tripStatus({
    is_full: contact.isFull,
    type: contact.type,
    end_date: contact.endDate,
  });
  if (!status.canContact) {
    // Location relatif (valid untuk 302) supaya tidak bergantung pada host.
    // Bukan klik kontak: jalur ini tidak boleh dicatat sebagai `contact_clicked`.
    return new NextResponse(null, {
      status: 302,
      headers: { ...HEADERS, Location: `/trip/${id}` },
    });
  }

  const url = buildContactUrl(contact.contactType, contact.contactValue);
  if (!url) return plain("Trip tidak ditemukan atau sudah dihapus.", 404);

  // `contact_clicked` HANYA dicatat di sini, pada jalur yang benar-benar
  // mengarahkan ke kontak. Prefetch dan bot tidak dihitung; pencatatan berjalan
  // setelah respons dan tidak pernah menahan redirect.
  if (!isPrefetchRequest(request.headers) && !isBot(request.headers.get("user-agent"))) {
    recordEventAfter({
      event: "contact_clicked",
      tripType: contact.type === "rencana" || contact.type === "niat" ? contact.type : null,
      tripId: id,
    });
  }

  return NextResponse.redirect(url, { status: 302, headers: HEADERS });
}

/**
 * HEAD (pemeriksa tautan, crawler): tidak pernah mengarah ke kontak dan tidak
 * mencatat event. Tidak menyentuh database.
 */
export function HEAD() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}
