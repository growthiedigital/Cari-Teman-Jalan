import { isBot } from "@/lib/analytics/is-bot";
import {
  isClientEventName,
  isEventTripType,
  type ClientEventName,
} from "@/lib/analytics/events";
import { recordEvent } from "@/lib/analytics/record-event";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isValidTripId } from "@/lib/trip/id";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 500;
const NO_STORE = { "Cache-Control": "no-store" };

const noContent = () => new Response(null, { status: 204, headers: NO_STORE });
const invalid = () =>
  Response.json({ message: "Data yang dikirim tidak valid." }, { status: 400, headers: NO_STORE });

type Parsed =
  | { ok: true; event: ClientEventName; tripType: string | null; tripId: string | null }
  | { ok: false };

function parseBody(body: unknown): Parsed {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false };
  const { event, tripType, tripId } = body as Record<string, unknown>;
  // Event `trip_created`, `card_downloaded`, `contact_clicked` hanya dicatat server.
  if (!isClientEventName(event)) return { ok: false };

  if (event === "form_opened") {
    // Jenis trip dari klien wajib enum valid; tidak ada trip yang dirujuk.
    if (!isEventTripType(tripType)) return { ok: false };
    return { ok: true, event, tripType, tripId: null };
  }
  if (!isValidTripId(tripId)) return { ok: false };
  return { ok: true, event, tripType: null, tripId };
}

/**
 * POST /api/events: hanya untuk event dari klien (`form_opened`,
 * `detail_viewed`, `link_copied`). Sukses atau diabaikan (bot, trip tidak ada,
 * database bermasalah) -> 204 tanpa body; body/event tidak valid -> 400.
 * Tanpa cookie dan tanpa identitas pengunjung: yang disimpan hanya event,
 * jenis trip, id trip, dan waktu.
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_CHARS * 4) return invalid();

  let text: string;
  try {
    text = await request.text();
  } catch {
    return invalid();
  }
  if (text.length > MAX_BODY_CHARS) return invalid();

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return invalid();
  }
  const parsed = parseBody(json);
  if (!parsed.ok) return invalid();

  // Bot (termasuk crawler pratinjau link) tidak dicatat dan tidak menyentuh database.
  if (isBot(request.headers.get("user-agent"))) return noContent();

  try {
    let tripType = parsed.tripType;
    if (parsed.tripId) {
      // Jenis trip diturunkan dari database; nilai dari klien tidak dipercaya.
      const { data, error } = await getSupabaseServer()
        .from("trips")
        .select("type")
        .eq("id", parsed.tripId)
        .maybeSingle();
      if (error) {
        console.error("[POST /api/events] query trip gagal", { code: error.code });
        return noContent();
      }
      const row = data as { type?: unknown } | null;
      // Trip tidak ada (atau sudah dihapus): jangan catat.
      if (!row || !isEventTripType(row.type)) return noContent();
      tripType = row.type;
    }
    await recordEvent({ event: parsed.event, tripType: isEventTripType(tripType) ? tripType : null, tripId: parsed.tripId });
  } catch {
    console.error("[POST /api/events] gagal memproses event");
  }
  return noContent();
}
