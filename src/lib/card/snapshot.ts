import { TAG_VALUES, TRIP_TYPES, type TripType } from "@/lib/trip/constants";
import type { TripInput } from "@/lib/trip/schema";

import { DEFAULT_THEME, isCardTheme, type CardTheme } from "./spec";

/**
 * Salinan field trip yang tampil di kartu (kolom `trips.card_snapshot`).
 * Sengaja TANPA nama pembuat, kontak, budget, itinerary, dan catatan.
 * Nama field snake_case mengikuti kolom `trips`, supaya fungsi format waktu
 * Tahap 2 bisa dipakai langsung.
 */
export type CardSnapshot = {
  type: TripType;
  title: string;
  destination: string;
  tags: string[];
  buddies_wanted: number | null;
  start_date: string | null;
  end_date: string | null;
  month_start: string | null;
  month_end: string | null;
  theme: CardTheme;
};

export function buildCardSnapshot(trip: TripInput): CardSnapshot {
  return {
    type: trip.type,
    title: trip.title,
    destination: trip.destination,
    tags: trip.tags,
    buddies_wanted: trip.buddiesWanted,
    start_date: trip.startDate,
    end_date: trip.endDate,
    month_start: trip.monthStart,
    month_end: trip.monthEnd,
    theme: trip.theme,
  };
}

const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const textOrNull = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/**
 * Baca kolom `card_snapshot` (JSON dari DB) dengan hati-hati. Objek kosong
 * `{}` (nilai bawaan kolom) atau bentuk yang tidak lengkap -> null, supaya
 * route membalas 404 dan bukan menggambar kartu rusak.
 */
export function parseCardSnapshot(value: unknown): CardSnapshot | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  if (!(TRIP_TYPES as readonly string[]).includes(raw.type as string)) return null;
  if (!isText(raw.title) || !isText(raw.destination)) return null;

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === "string" && TAG_VALUES.includes(t))
    : [];

  const buddies =
    typeof raw.buddies_wanted === "number" && Number.isInteger(raw.buddies_wanted)
      ? raw.buddies_wanted
      : null;

  const snapshot: CardSnapshot = {
    type: raw.type as TripType,
    title: raw.title,
    destination: raw.destination,
    tags,
    buddies_wanted: buddies,
    start_date: textOrNull(raw.start_date),
    end_date: textOrNull(raw.end_date),
    month_start: textOrNull(raw.month_start),
    month_end: textOrNull(raw.month_end),
    theme: isCardTheme(raw.theme) ? raw.theme : DEFAULT_THEME,
  };

  // Waktu wajib ada sesuai jenis; tanpa itu kartu tidak bermakna.
  if (snapshot.type === "rencana" && (!snapshot.start_date || !snapshot.end_date)) return null;
  if (snapshot.type === "niat" && !snapshot.month_start) return null;
  return snapshot;
}
