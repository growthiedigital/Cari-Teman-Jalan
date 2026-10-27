import { NextResponse } from "next/server";

import { buildCardSnapshot } from "@/lib/card/snapshot";
import { renderCard } from "@/lib/card/render-card";
import { PREVIEW_TRIP_ID, getSiteUrl, tripUrl } from "@/lib/card/site-url";
import { parseRatio } from "@/lib/card/spec";
import { validateTrip } from "@/lib/trip/schema";

export const dynamic = "force-dynamic";

// Data form paling besar sekitar 1 KB teks; 20.000 sama dengan POST /api/trips.
const MAX_BODY_CHARS = 20_000;
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * POST /api/card/preview?r=9x16|4x5
 * Pratinjau kartu dari data form (JSON di body, bukan di URL). Memakai skema
 * validasi dan renderer yang SAMA dengan penyimpanan, tetapi tidak menyentuh
 * database dan QR-nya mengarah ke URL contoh.
 */
export async function POST(request: Request) {
  const ratio = parseRatio(new URL(request.url).searchParams.get("r"));
  if (!ratio) return json({ message: "Parameter r harus 9x16 atau 4x5." }, 400);

  let text: string;
  try {
    text = await request.text();
  } catch {
    return json({ message: "Data yang dikirim tidak valid." }, 400);
  }
  if (text.length > MAX_BODY_CHARS) {
    return json({ message: "Data yang dikirim terlalu besar." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ message: "Data yang dikirim tidak valid." }, 400);
  }

  const result = validateTrip(body);
  if (!result.ok) {
    return json(
      { message: "Beberapa isian belum benar. Periksa kembali.", errors: result.errors },
      400,
    );
  }

  try {
    return await renderCard(buildCardSnapshot(result.data), {
      ratio,
      size: "full",
      url: tripUrl(getSiteUrl(request.url), PREVIEW_TRIP_ID),
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("[POST /api/card/preview] gagal merender", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return json({ message: "Gagal membuat pratinjau kartu." }, 500);
  }
}
