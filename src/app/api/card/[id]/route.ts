import { NextResponse } from "next/server";

import { renderCard } from "@/lib/card/render-card";
import { getSiteUrl, tripUrl } from "@/lib/card/site-url";
import { parseRatio, parseSize } from "@/lib/card/spec";
import { isValidTripId } from "@/lib/trip/id";
import { getCardSnapshot } from "@/lib/trip/queries";

export const dynamic = "force-dynamic";

// Bukan `immutable` seumur hidup: kartu trip yang dihapus tidak boleh tertahan
// lama di CDN. 5 menit di browser, 1 jam di CDN, lalu boleh dipakai ulang
// sambil diperbarui di latar belakang sampai 1 hari.
const CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

function plain(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * GET /api/card/{id}?r=9x16|4x5&size=og&download=1
 * Menggambar kartu dari `card_snapshot` (bukan data trip terbaru).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/card/[id]">) {
  const { id } = await ctx.params;
  const params = new URL(request.url).searchParams;

  // Validasi dulu; semuanya terjadi sebelum database disentuh.
  if (!isValidTripId(id)) return plain("Kartu tidak ditemukan.", 404);
  const ratio = parseRatio(params.get("r"));
  if (!ratio) return plain("Parameter r harus 9x16 atau 4x5.", 400);
  const size = parseSize(params.get("size"));
  if (!size) return plain("Parameter size hanya boleh og atau dikosongkan.", 400);

  let snapshot: Awaited<ReturnType<typeof getCardSnapshot>>;
  try {
    snapshot = await getCardSnapshot(id);
  } catch {
    return plain("Terjadi kesalahan di server. Coba lagi beberapa saat lagi.", 500);
  }
  if (!snapshot) return plain("Kartu tidak ditemukan.", 404);

  const headers: Record<string, string> = { "cache-control": CACHE_CONTROL };
  if (params.get("download") === "1") {
    headers["content-disposition"] = `attachment; filename="trip-card-${id}-${ratio}.png"`;
  }

  // Tahap 6: catat event `card_downloaded` hanya dari tombol "Unduh gambar"
  // di klien (bukan di sini; route ini juga dipakai crawler dan pratinjau).
  try {
    return await renderCard(snapshot, {
      ratio,
      size,
      url: tripUrl(getSiteUrl(request.url), id),
      headers,
    });
  } catch (error) {
    console.error("[GET /api/card/[id]] gagal merender", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return plain("Gagal membuat gambar kartu.", 500);
  }
}
