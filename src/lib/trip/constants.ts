export const TRIP_TYPES = ["rencana", "niat"] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  rencana: "Sudah ada rencana",
  niat: "Masih pengen, cari peminat",
};

export const CONTACT_TYPES = ["whatsapp", "instagram"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_LABELS: Record<ContactType, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

// Label tampil -> nilai DB. Urutan di sini adalah urutan tampil di form.
export const TAGS = [
  { value: "foodie", label: "Foodie" },
  { value: "santai", label: "Santai" },
  { value: "budget", label: "Budget" },
  { value: "petualang", label: "Petualang" },
  { value: "foto-foto", label: "Foto-foto" },
  { value: "budaya-sejarah", label: "Budaya/Sejarah" },
  { value: "alam", label: "Alam" },
] as const;

export type TagValue = (typeof TAGS)[number]["value"];

export const TAG_VALUES: readonly string[] = TAGS.map((t) => t.value);

export const TAG_LABELS: Record<string, string> = Object.fromEntries(
  TAGS.map((t) => [t.value, t.label]),
);

export const LIMITS = {
  destination: 60,
  title: 80,
  creatorName: 30,
  note: 200,
  itinerary: 500,
  intention: 200,
  tagsMin: 1,
  tagsMax: 3,
  buddiesMin: 1,
  buddiesMax: 10,
  budgetMin: 0,
  budgetMax: 100_000_000,
  waMinDigits: 10,
  waMaxDigits: 15,
  igMaxLength: 30,
} as const;

// Nama field yang dipakai di payload, di form, dan di respons error.
export type TripField =
  | "type"
  | "destination"
  | "title"
  | "creatorName"
  | "tags"
  | "buddiesWanted"
  | "note"
  | "budget"
  | "contactType"
  | "contactValue"
  | "startDate"
  | "endDate"
  | "itinerary"
  | "monthStart"
  | "monthEnd"
  | "intention"
  | "deviceId";

// "form" dipakai untuk kesalahan yang bukan milik satu field tertentu.
export type TripErrors = Partial<Record<TripField | "form", string>>;
