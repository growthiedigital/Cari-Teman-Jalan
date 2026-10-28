import type { ContactType } from "./constants";
import type { EditableTripRow } from "./edit-columns";

/** Isian form (semua teks, seperti di kolom input) untuk /buat dan /edit. */
export type FormValues = {
  destination: string;
  title: string;
  creatorName: string;
  tags: string[];
  buddiesWanted: string;
  note: string;
  budget: string;
  contactType: ContactType;
  contactValue: string;
  startDate: string;
  endDate: string;
  itinerary: string;
  monthStart: string;
  monthEnd: string;
  intention: string;
};

export const INITIAL_FORM_VALUES: FormValues = {
  destination: "",
  title: "",
  creatorName: "",
  tags: [],
  buddiesWanted: "",
  note: "",
  budget: "",
  contactType: "whatsapp",
  contactValue: "",
  startDate: "",
  endDate: "",
  itinerary: "",
  monthStart: "",
  monthEnd: "",
  intention: "",
};

const text = (value: string | number | null) => (value === null ? "" : String(value));

/** Baris trip dari database -> isian awal form edit. */
export function tripRowToFormValues(row: EditableTripRow): FormValues {
  return {
    destination: row.destination,
    title: row.title,
    creatorName: row.creator_name,
    tags: [...row.tags],
    buddiesWanted: text(row.buddies_wanted),
    note: text(row.note),
    budget: text(row.budget),
    contactType: row.contact_type,
    contactValue: row.contact_value,
    startDate: text(row.start_date),
    endDate: text(row.end_date),
    itinerary: text(row.itinerary),
    monthStart: text(row.month_start),
    monthEnd: text(row.month_end),
    intention: text(row.intention),
  };
}
