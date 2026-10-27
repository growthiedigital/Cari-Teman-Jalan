import { z } from "zod";

import {
  CONTACT_TYPES,
  LIMITS,
  TAG_VALUES,
  TRIP_TYPES,
  type ContactType,
  type TagValue,
  type TripErrors,
  type TripField,
  type TripType,
} from "./constants";
import {
  currentMonthJakarta,
  isValidDateString,
  todayJakarta,
} from "./dates";

/**
 * Skema validasi Trip Card. Dipakai SAMA PERSIS di klien (form) dan di server
 * (POST /api/trips); server yang otoritatif. Tanpa `server-only` supaya bisa
 * diimpor dari komponen klien.
 */

// ---------------------------------------------------------------------------
// Hasil yang sudah tervalidasi dan ternormalisasi
// ---------------------------------------------------------------------------
export type TripInput = {
  type: TripType;
  destination: string;
  title: string;
  creatorName: string;
  tags: TagValue[];
  buddiesWanted: number | null;
  note: string | null;
  budget: number | null;
  contactType: ContactType;
  contactValue: string;
  /** Jenis rencana (YYYY-MM-DD), selain itu null. */
  startDate: string | null;
  endDate: string | null;
  itinerary: string | null;
  /** Jenis niat (selalu tanggal 1, YYYY-MM-01), selain itu null. */
  monthStart: string | null;
  monthEnd: string | null;
  intention: string | null;
  deviceId: string;
};

export type ValidationResult =
  | { ok: true; data: TripInput }
  | { ok: false; errors: TripErrors };

// ---------------------------------------------------------------------------
// Normalisasi murni (diuji langsung)
// ---------------------------------------------------------------------------
type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (message: string): Parsed<never> => ({ ok: false, message });

// Karakter kontrol (kecuali tab dan baris baru) dibuang; \u0000 ditolak Postgres.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Panjang dalam code point, sama dengan char_length() Postgres. */
export function textLength(value: string): number {
  return Array.from(value).length;
}

/** Pangkas spasi di tepi; null/undefined jadi "". Nilai non-teks dikembalikan apa adanya. */
function toTrimmed(value: unknown): unknown {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return value;
  return value.replace(CONTROL_CHARS, "").trim();
}

/**
 * WhatsApp -> format internasional tanpa plus.
 * 08xx -> 628xx; +62/62 dibiarkan; spasi, tanda hubung, titik, dan kurung dibuang.
 * Tanpa 0 dan tanpa plus, angka berawalan 8 dianggap nomor Indonesia (8xx -> 628xx).
 */
export function normalizeWhatsapp(input: string): Parsed<string> {
  let value = input.replace(/[\s\-.()]/g, "");
  const hadPlus = value.startsWith("+");
  if (hadPlus) value = value.slice(1);
  if (!/^\d+$/.test(value)) {
    return fail("Nomor WhatsApp hanya boleh berisi angka (boleh diawali +).");
  }
  if (value.startsWith("00")) value = value.slice(2); // 0062... -> 62...
  else if (value.startsWith("0")) value = `62${value.slice(1)}`;
  else if (!hadPlus && value.startsWith("8")) value = `62${value}`;

  const digits = value.length;
  if (digits < LIMITS.waMinDigits || digits > LIMITS.waMaxDigits) {
    return fail(
      `Nomor WhatsApp harus ${LIMITS.waMinDigits}-${LIMITS.waMaxDigits} digit.`,
    );
  }
  return ok(value);
}

/**
 * Instagram -> handle tanpa awalan @ / ＠ dan tanpa URL, huruf kecil.
 * Hanya huruf, angka, titik, dan garis bawah; 1-30 karakter.
 */
export function normalizeInstagram(input: string): Parsed<string> {
  let value = input.trim();
  value = value.replace(/^[@＠]+/, "");
  const url = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/(.*)$/i.exec(
    value,
  );
  if (url) {
    value = url[1].split(/[/?#]/)[0].replace(/^[@＠]+/, "");
  }
  if (!/^[A-Za-z0-9._]+$/.test(value)) {
    return fail(
      "Username Instagram hanya boleh berisi huruf, angka, titik, dan garis bawah.",
    );
  }
  if (value.length > LIMITS.igMaxLength) {
    return fail(`Username Instagram maksimal ${LIMITS.igMaxLength} karakter.`);
  }
  return ok(value.toLowerCase());
}

export function normalizeContact(
  type: ContactType,
  input: string,
): Parsed<string> {
  return type === "whatsapp" ? normalizeWhatsapp(input) : normalizeInstagram(input);
}

/**
 * Angka bulat opsional dari form (teks) atau JSON (number).
 * Teks boleh memakai titik sebagai pemisah ribuan ("1.500.000").
 */
function parseOptionalInt(value: unknown, label: string): Parsed<number | null> {
  if (value === null || value === undefined) return ok(null);
  if (typeof value === "number") {
    return Number.isInteger(value) ? ok(value) : fail(`${label} harus berupa bilangan bulat.`);
  }
  if (typeof value !== "string") return fail(`${label} harus berupa angka.`);
  const text = value.replace(/\s/g, "");
  if (text === "") return ok(null);
  const plain = /^-?\d+$/.test(text);
  const grouped = /^\d{1,3}(\.\d{3})+$/.test(text);
  if (!plain && !grouped) return fail(`${label} harus berupa angka bulat.`);
  const number = Number(grouped ? text.replace(/\./g, "") : text);
  return Number.isSafeInteger(number) ? ok(number) : fail(`${label} terlalu besar.`);
}

// ---------------------------------------------------------------------------
// Skema per field (zod)
// ---------------------------------------------------------------------------
/** Bungkus fungsi normalisasi menjadi skema zod yang memberi satu pesan error. */
function custom<T>(fn: (value: unknown) => Parsed<T>) {
  return z.unknown().transform((value, ctx) => {
    const result = fn(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.message });
      return z.NEVER;
    }
    return result.value;
  });
}

function requiredText(label: string, max: number) {
  const required = `${label} wajib diisi.`;
  return z.preprocess(
    toTrimmed,
    z
      .string({ error: `${label} harus berupa teks.` })
      .min(1, required)
      .refine((s) => textLength(s) <= max, `${label} maksimal ${max} karakter.`),
  );
}

function optionalText(label: string, max: number) {
  return z.preprocess(
    toTrimmed,
    z
      .string({ error: `${label} harus berupa teks.` })
      .refine((s) => textLength(s) <= max, `${label} maksimal ${max} karakter.`)
      .transform((s) => (s === "" ? null : s)),
  );
}

function enumField<T extends string>(values: readonly T[], message: string) {
  return z.unknown().transform((value, ctx) => {
    if (typeof value === "string" && (values as readonly string[]).includes(value)) {
      return value as T;
    }
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  });
}

const tagsField = custom<TagValue[]>((value) => {
  const message = `Pilih ${LIMITS.tagsMin} sampai ${LIMITS.tagsMax} tag selera.`;
  if (!Array.isArray(value)) return fail(message);
  if (!value.every((t) => typeof t === "string" && TAG_VALUES.includes(t))) {
    return fail("Ada tag yang tidak dikenal.");
  }
  const unique = Array.from(new Set(value as string[])) as TagValue[];
  if (unique.length < LIMITS.tagsMin || unique.length > LIMITS.tagsMax) return fail(message);
  return ok(unique);
});

const buddiesField = custom<number | null>((value) => {
  const message = `Jumlah teman harus angka ${LIMITS.buddiesMin} sampai ${LIMITS.buddiesMax}.`;
  const parsed = parseOptionalInt(value, "Jumlah teman");
  if (!parsed.ok) return fail(message);
  const n = parsed.value;
  if (n !== null && (n < LIMITS.buddiesMin || n > LIMITS.buddiesMax)) return fail(message);
  return ok(n);
});

const budgetField = custom<number | null>((value) => {
  const parsed = parseOptionalInt(value, "Budget");
  if (!parsed.ok) return parsed;
  const n = parsed.value;
  if (n !== null && (n < LIMITS.budgetMin || n > LIMITS.budgetMax)) {
    return fail("Budget harus antara Rp0 dan Rp100.000.000 per orang.");
  }
  return ok(n);
});

function requiredDate(label: string, today: string, pastMessage: string) {
  return custom<string>((value) => {
    const text = toTrimmed(value);
    if (typeof text !== "string") return fail(`${label} tidak valid.`);
    if (text === "") return fail(`${label} wajib diisi.`);
    if (!isValidDateString(text)) return fail(`${label} tidak valid.`);
    if (text < today) return fail(pastMessage);
    return ok(text);
  });
}

/** Bulan dari "YYYY-MM" atau "YYYY-MM-01"; hasilnya selalu "YYYY-MM-01". */
function parseMonth(text: string): string | null {
  const m = /^(\d{4})-(\d{2})(?:-01)?$/.exec(text);
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? `${m[1]}-${m[2]}-01` : null;
}

function monthField(
  label: string,
  required: boolean,
  currentMonth: string,
  pastMessage: string,
) {
  return custom<string | null>((value) => {
    const raw = toTrimmed(value);
    if (typeof raw !== "string") return fail(`${label} tidak valid.`);
    if (raw === "") return required ? fail(`${label} wajib diisi.`) : ok(null);
    const month = parseMonth(raw);
    if (month === null) return fail(`${label} tidak valid.`);
    if (month < currentMonth) return fail(pastMessage);
    return ok(month);
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deviceIdField = custom<string>((value) =>
  typeof value === "string" && UUID.test(value)
    ? ok(value.toLowerCase())
    : fail("ID perangkat tidak valid. Muat ulang halaman lalu coba lagi."),
);

// ---------------------------------------------------------------------------
// Validasi utama
// ---------------------------------------------------------------------------
const typeField = enumField(TRIP_TYPES, "Pilih jenis trip.");
const contactTypeField = enumField(CONTACT_TYPES, "Pilih WhatsApp atau Instagram.");

function firstMessage(result: { success: boolean; error?: z.ZodError }): string {
  return result.error?.issues[0]?.message ?? "Isian tidak valid.";
}

/**
 * Validasi + normalisasi satu isian trip. `now` hanya dipakai untuk acuan
 * "hari ini" (zona Asia/Jakarta) dan bisa diganti di uji.
 *
 * Tiap field divalidasi terpisah supaya semua pesan error muncul sekaligus,
 * termasuk pemeriksaan antar-field (tanggal pulang vs berangkat).
 */
export function validateTrip(raw: unknown, now: Date = new Date()): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: { form: "Data yang dikirim tidak valid." } };
  }
  const input = raw as Record<string, unknown>;
  const errors: TripErrors = {};
  const today = todayJakarta(now);
  const thisMonth = currentMonthJakarta(now);

  function run<T>(field: TripField, schema: z.ZodType<T>): T | undefined {
    const result = schema.safeParse(input[field]);
    if (result.success) return result.data;
    errors[field] = firstMessage(result);
    return undefined;
  }

  const type = run("type", typeField);
  const destination = run("destination", requiredText("Tujuan", LIMITS.destination));
  const titleInput = run("title", optionalText("Judul", LIMITS.title));
  const creatorName = run("creatorName", requiredText("Nama", LIMITS.creatorName));
  const tags = run("tags", tagsField);
  const buddiesWanted = run("buddiesWanted", buddiesField);
  const note = run("note", optionalText("Catatan", LIMITS.note));
  const budget = run("budget", budgetField);
  const deviceId = run("deviceId", deviceIdField);

  // Kontak: aturan nilai bergantung pada jenis kontak.
  const contactType = run("contactType", contactTypeField);
  let contactValue: string | undefined;
  {
    const text = toTrimmed(input.contactValue);
    if (typeof text !== "string") {
      errors.contactValue = "Kontak harus berupa teks.";
    } else if (text === "") {
      errors.contactValue = "Kontak wajib diisi.";
    } else if (contactType) {
      const result = normalizeContact(contactType, text);
      if (result.ok) contactValue = result.value;
      else errors.contactValue = result.message;
    }
  }

  // Bagian khusus jenis trip.
  let startDate: string | null = null;
  let endDate: string | null = null;
  let itinerary: string | null = null;
  let monthStart: string | null = null;
  let monthEnd: string | null = null;
  let intention: string | null = null;

  if (type === "rencana") {
    const start = run(
      "startDate",
      requiredDate("Tanggal berangkat", today, "Tanggal berangkat tidak boleh di masa lalu."),
    );
    const end = run(
      "endDate",
      requiredDate("Tanggal pulang", today, "Tanggal pulang tidak boleh di masa lalu."),
    );
    if (start && end && end < start) {
      errors.endDate = "Tanggal pulang tidak boleh sebelum tanggal berangkat.";
    }
    startDate = start ?? null;
    endDate = end ?? null;
    itinerary = run("itinerary", optionalText("Itinerary", LIMITS.itinerary)) ?? null;
  } else if (type === "niat") {
    const start = run(
      "monthStart",
      monthField("Bulan awal", true, thisMonth, "Bulan awal tidak boleh di masa lalu."),
    );
    const end = run(
      "monthEnd",
      monthField("Bulan akhir", false, thisMonth, "Bulan akhir tidak boleh di masa lalu."),
    );
    if (start && end && end < start) {
      errors.monthEnd = "Bulan akhir tidak boleh sebelum bulan awal.";
    }
    monthStart = start ?? null;
    monthEnd = end ?? null;
    intention = run("intention", optionalText("Niat singkat", LIMITS.intention)) ?? null;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Semua field lolos, jadi nilai-nilai di bawah pasti terisi.
  const dest = destination as string;
  return {
    ok: true,
    data: {
      type: type as TripType,
      destination: dest,
      title: titleInput ?? `Trip ke ${dest}`,
      creatorName: creatorName as string,
      tags: tags as TagValue[],
      buddiesWanted: buddiesWanted ?? null,
      note: note ?? null,
      budget: budget ?? null,
      contactType: contactType as ContactType,
      contactValue: contactValue as string,
      startDate,
      endDate,
      itinerary,
      monthStart,
      monthEnd,
      intention,
      deviceId: deviceId as string,
    },
  };
}
