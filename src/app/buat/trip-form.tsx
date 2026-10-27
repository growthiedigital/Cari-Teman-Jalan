"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import {
  CONTACT_LABELS,
  CONTACT_TYPES,
  LIMITS,
  TAGS,
  TAG_LABELS,
  TRIP_TYPE_LABELS,
  TRIP_TYPES,
  type ContactType,
  type TripErrors,
  type TripField,
  type TripType,
} from "@/lib/trip/constants";
import { DEFAULT_THEME, type CardTheme } from "@/lib/card/spec";
import { formatDateId, formatMonthId, formatRupiah } from "@/lib/trip/dates";
import { getDeviceId, saveMyTrip } from "@/lib/trip/local-storage";
import { textLength, validateTrip, type TripInput } from "@/lib/trip/schema";

import { CardPreview } from "./card-preview";

type Props = {
  today: string;
  months: { value: string; label: string }[];
};

type FormValues = {
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

type Step = "type" | "form" | "preview";

const INITIAL: FormValues = {
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

// Urutan field di layar; dipakai untuk memfokuskan error pertama.
const FIELD_ORDER: TripField[] = [
  "destination",
  "startDate",
  "endDate",
  "monthStart",
  "monthEnd",
  "tags",
  "budget",
  "itinerary",
  "intention",
  "buddiesWanted",
  "title",
  "note",
  "creatorName",
  "contactValue",
];

const GENERIC_SUBMIT_ERROR = "Terjadi kesalahan. Coba lagi beberapa saat lagi.";

const inputClass = (error?: string) =>
  `w-full rounded-xl border bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-2 focus:outline-offset-2 focus:outline-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:outline-zinc-100 ${
    error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"
  }`;

const primaryButton =
  "w-full rounded-xl bg-zinc-900 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900";
const secondaryButton =
  "w-full rounded-xl border border-zinc-300 px-4 py-3.5 text-base font-semibold dark:border-zinc-700";

function Field({
  name,
  label,
  optional,
  error,
  hint,
  counter,
  children,
}: {
  name: TripField;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  counter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`f-${name}`} className="text-sm font-semibold">
          {label}
          {optional && (
            <span className="ml-1 font-normal text-zinc-500">(opsional)</span>
          )}
        </label>
        {counter}
      </div>
      {children}
      {hint && !error && <p className="text-sm text-zinc-500">{hint}</p>}
      {error && (
        <p id={`e-${name}`} className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  const length = textLength(value.trim());
  return (
    <span
      className={`text-xs ${length > max ? "font-semibold text-red-600 dark:text-red-400" : "text-zinc-500"}`}
    >
      {length}/{max}
    </span>
  );
}

function PreviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap break-words text-base">{value}</dd>
    </div>
  );
}

function timeLabel(trip: TripInput): string {
  if (trip.type === "rencana") {
    return `${formatDateId(trip.startDate as string)} sampai ${formatDateId(trip.endDate as string)}`;
  }
  const start = formatMonthId(trip.monthStart as string);
  if (!trip.monthEnd || trip.monthEnd === trip.monthStart) return start;
  return `${start} sampai ${formatMonthId(trip.monthEnd)}`;
}

export function TripForm({ today, months }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<TripType | null>(null);
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [errors, setErrors] = useState<TripErrors>({});
  const [theme, setTheme] = useState<CardTheme>(DEFAULT_THEME);
  const [preview, setPreview] = useState<TripInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as TripField]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function focusFirstError(found: TripErrors) {
    const first = FIELD_ORDER.find((field) => found[field]);
    if (!first) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(`f-${first}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  }

  function chooseType(next: TripType) {
    setType(next);
    setStep("form");
    window.scrollTo(0, 0);
  }

  function toggleTag(value: string) {
    const has = values.tags.includes(value);
    if (!has && values.tags.length >= LIMITS.tagsMax) return;
    setValue(
      "tags",
      has ? values.tags.filter((t) => t !== value) : [...values.tags, value],
    );
  }

  function handlePreview(event: FormEvent) {
    event.preventDefault();
    const result = validateTrip({ ...values, type, theme, deviceId: getDeviceId() });
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstError(result.errors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setPreview(result.data);
    setStep("preview");
    window.scrollTo(0, 0);
  }

  async function handleSubmit() {
    if (!preview || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    let navigating = false;
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, type, theme, deviceId: preview.deviceId }),
      });
      const data: unknown = await response.json().catch(() => null);
      const body = (data ?? {}) as {
        id?: unknown;
        editToken?: unknown;
        message?: unknown;
        errors?: TripErrors;
      };

      if (response.status === 400 && body.errors) {
        setErrors(body.errors);
        setStep("form");
        window.scrollTo(0, 0);
        return;
      }
      if (
        !response.ok ||
        typeof body.id !== "string" ||
        typeof body.editToken !== "string"
      ) {
        setSubmitError(
          response.status < 500 && typeof body.message === "string"
            ? body.message
            : GENERIC_SUBMIT_ERROR,
        );
        return;
      }

      saveMyTrip({
        id: body.id,
        editToken: body.editToken,
        title: preview.title,
        createdAt: new Date().toISOString(),
      });
      navigating = true;
      router.push(`/sukses?id=${encodeURIComponent(body.id)}`);
    } catch {
      setSubmitError("Tidak bisa terhubung ke server. Periksa koneksi internetmu lalu coba lagi.");
    } finally {
      if (!navigating) setSubmitting(false);
    }
  }

  const shell = "mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8";

  // -------------------------------------------------------------------------
  // Langkah 1: pilih jenis trip
  // -------------------------------------------------------------------------
  if (step === "type") {
    const descriptions: Record<TripType, string> = {
      rencana: "Tanggal berangkat dan pulang sudah jelas. Tinggal cari teman.",
      niat: "Baru ada keinginan dan perkiraan bulan. Cari yang tertarik dulu.",
    };
    return (
      <main className={shell}>
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Buat trip</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Pilih jenis trip yang paling cocok.
          </p>
        </header>
        <div className="flex flex-col gap-4">
          {TRIP_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => chooseType(t)}
              className="flex flex-col gap-1 rounded-2xl border-2 border-zinc-300 p-5 text-left active:bg-zinc-100 dark:border-zinc-700 dark:active:bg-zinc-900"
            >
              <span className="text-xl font-bold">{TRIP_TYPE_LABELS[t]}</span>
              <span className="text-zinc-600 dark:text-zinc-400">{descriptions[t]}</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Langkah 3: pratinjau (kontak hanya jenisnya, bukan nilainya)
  // -------------------------------------------------------------------------
  if (step === "preview" && preview) {
    return (
      <main className={shell}>
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Cek dulu</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Pastikan semuanya sudah benar sebelum dikirim.
          </p>
        </header>
        <CardPreview
          payload={{ ...values, type, theme, deviceId: preview.deviceId }}
          theme={theme}
          onThemeChange={setTheme}
        />
        <dl className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 px-4 dark:divide-zinc-800 dark:border-zinc-800">
          <PreviewRow label="Jenis" value={TRIP_TYPE_LABELS[preview.type]} />
          <PreviewRow label="Judul" value={preview.title} />
          <PreviewRow label="Tujuan" value={preview.destination} />
          <PreviewRow label="Waktu" value={timeLabel(preview)} />
          <PreviewRow
            label="Tag selera"
            value={preview.tags.map((t) => TAG_LABELS[t]).join(", ")}
          />
          <PreviewRow
            label="Jumlah teman dicari"
            value={preview.buddiesWanted ? `${preview.buddiesWanted} orang` : "-"}
          />
          <PreviewRow
            label="Budget per orang"
            value={preview.budget === null ? "-" : formatRupiah(preview.budget)}
          />
          {preview.type === "rencana" ? (
            <PreviewRow label="Ringkasan itinerary" value={preview.itinerary ?? "-"} />
          ) : (
            <PreviewRow label="Niat singkat" value={preview.intention ?? "-"} />
          )}
          <PreviewRow label="Catatan" value={preview.note ?? "-"} />
          <PreviewRow label="Nama" value={preview.creatorName} />
          <PreviewRow
            label="Kontak"
            value={`Orang akan menghubungi lewat ${CONTACT_LABELS[preview.contactType]}`}
          />
        </dl>
        {submitError && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            {submitError}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <button type="button" onClick={handleSubmit} disabled={submitting} className={primaryButton}>
            {submitting ? "Mengirim..." : "Kirim"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("form");
              window.scrollTo(0, 0);
            }}
            disabled={submitting}
            className={secondaryButton}
          >
            Ubah
          </button>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Langkah 2: form
  // -------------------------------------------------------------------------
  const isRencana = type === "rencana";
  const err = (field: TripField) => errors[field];
  const describe = (field: TripField) => (err(field) ? `e-${field}` : undefined);
  const formError = errors.form ?? errors.deviceId ?? errors.type;

  return (
    <main className={shell}>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Buat trip</h1>
        <p className="flex items-center justify-between gap-3 rounded-xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-900">
          <span className="font-semibold">{type ? TRIP_TYPE_LABELS[type] : ""}</span>
          <button
            type="button"
            onClick={() => {
              setStep("type");
              window.scrollTo(0, 0);
            }}
            className="font-semibold underline"
          >
            Ganti jenis
          </button>
        </p>
      </header>

      <form onSubmit={handlePreview} noValidate className="flex flex-col gap-5">
        {formError && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            {formError}
          </p>
        )}

        <Field
          name="destination"
          label="Tujuan"
          error={err("destination")}
          counter={<Counter value={values.destination} max={LIMITS.destination} />}
        >
          <input
            id="f-destination"
            type="text"
            value={values.destination}
            onChange={(e) => setValue("destination", e.target.value)}
            placeholder="mis. Labuan Bajo"
            autoComplete="off"
            aria-invalid={!!err("destination")}
            aria-describedby={describe("destination")}
            className={inputClass(err("destination"))}
          />
        </Field>

        {isRencana ? (
          <>
            <Field name="startDate" label="Tanggal berangkat" error={err("startDate")}>
              <input
                id="f-startDate"
                type="date"
                min={today}
                value={values.startDate}
                onChange={(e) => setValue("startDate", e.target.value)}
                aria-invalid={!!err("startDate")}
                aria-describedby={describe("startDate")}
                className={inputClass(err("startDate"))}
              />
            </Field>
            <Field name="endDate" label="Tanggal pulang" error={err("endDate")}>
              <input
                id="f-endDate"
                type="date"
                min={values.startDate || today}
                value={values.endDate}
                onChange={(e) => setValue("endDate", e.target.value)}
                aria-invalid={!!err("endDate")}
                aria-describedby={describe("endDate")}
                className={inputClass(err("endDate"))}
              />
            </Field>
          </>
        ) : (
          <>
            <Field name="monthStart" label="Perkiraan bulan berangkat" error={err("monthStart")}>
              <select
                id="f-monthStart"
                value={values.monthStart}
                onChange={(e) => setValue("monthStart", e.target.value)}
                aria-invalid={!!err("monthStart")}
                aria-describedby={describe("monthStart")}
                className={inputClass(err("monthStart"))}
              >
                <option value="">Pilih bulan</option>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              name="monthEnd"
              label="Sampai bulan"
              optional
              error={err("monthEnd")}
              hint="Isi kalau waktunya berupa rentang, mis. Juli sampai Agustus."
            >
              <select
                id="f-monthEnd"
                value={values.monthEnd}
                onChange={(e) => setValue("monthEnd", e.target.value)}
                aria-invalid={!!err("monthEnd")}
                aria-describedby={describe("monthEnd")}
                className={inputClass(err("monthEnd"))}
              >
                <option value="">Tidak ada</option>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span id="l-tags" className="text-sm font-semibold">
              Selera trip
            </span>
            <span className="text-xs text-zinc-500">
              {values.tags.length}/{LIMITS.tagsMax} dipilih
            </span>
          </div>
          <div
            id="f-tags"
            tabIndex={-1}
            role="group"
            aria-labelledby="l-tags"
            aria-describedby={describe("tags")}
            className="flex flex-wrap gap-2 focus:outline-none"
          >
            {TAGS.map((tag) => {
              const selected = values.tags.includes(tag.value);
              const locked = !selected && values.tags.length >= LIMITS.tagsMax;
              return (
                <button
                  key={tag.value}
                  type="button"
                  aria-pressed={selected}
                  disabled={locked}
                  onClick={() => toggleTag(tag.value)}
                  className={`rounded-full border px-4 py-2 text-base font-medium disabled:opacity-40 ${
                    selected
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                      : err("tags")
                        ? "border-red-500"
                        : "border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          {!err("tags") && (
            <p className="text-sm text-zinc-500">Pilih 1 sampai 3.</p>
          )}
          {err("tags") && (
            <p id="e-tags" className="text-sm font-medium text-red-600 dark:text-red-400">
              {err("tags")}
            </p>
          )}
        </div>

        <Field
          name="budget"
          label="Budget per orang (Rp)"
          optional
          error={err("budget")}
        >
          <input
            id="f-budget"
            type="text"
            inputMode="numeric"
            value={values.budget}
            onChange={(e) => setValue("budget", e.target.value)}
            placeholder="mis. 1500000"
            autoComplete="off"
            aria-invalid={!!err("budget")}
            aria-describedby={describe("budget")}
            className={inputClass(err("budget"))}
          />
        </Field>

        {isRencana ? (
          <Field
            name="itinerary"
            label="Ringkasan itinerary"
            optional
            error={err("itinerary")}
            counter={<Counter value={values.itinerary} max={LIMITS.itinerary} />}
          >
            <textarea
              id="f-itinerary"
              rows={4}
              value={values.itinerary}
              onChange={(e) => setValue("itinerary", e.target.value)}
              aria-invalid={!!err("itinerary")}
              aria-describedby={describe("itinerary")}
              className={inputClass(err("itinerary"))}
            />
          </Field>
        ) : (
          <Field
            name="intention"
            label="Niat singkat"
            optional
            error={err("intention")}
            counter={<Counter value={values.intention} max={LIMITS.intention} />}
          >
            <textarea
              id="f-intention"
              rows={3}
              value={values.intention}
              onChange={(e) => setValue("intention", e.target.value)}
              placeholder="mis. Pengen healing ke pantai, santai aja"
              aria-invalid={!!err("intention")}
              aria-describedby={describe("intention")}
              className={inputClass(err("intention"))}
            />
          </Field>
        )}

        <Field
          name="buddiesWanted"
          label="Jumlah teman yang dicari"
          optional
          error={err("buddiesWanted")}
        >
          <input
            id="f-buddiesWanted"
            type="text"
            inputMode="numeric"
            value={values.buddiesWanted}
            onChange={(e) => setValue("buddiesWanted", e.target.value)}
            placeholder="1 sampai 10"
            autoComplete="off"
            aria-invalid={!!err("buddiesWanted")}
            aria-describedby={describe("buddiesWanted")}
            className={inputClass(err("buddiesWanted"))}
          />
        </Field>

        <Field
          name="title"
          label="Judul"
          optional
          error={err("title")}
          hint={`Kalau kosong, otomatis "Trip ke ${values.destination.trim() || "…"}".`}
          counter={<Counter value={values.title} max={LIMITS.title} />}
        >
          <input
            id="f-title"
            type="text"
            value={values.title}
            onChange={(e) => setValue("title", e.target.value)}
            autoComplete="off"
            aria-invalid={!!err("title")}
            aria-describedby={describe("title")}
            className={inputClass(err("title"))}
          />
        </Field>

        <Field
          name="note"
          label="Catatan singkat"
          optional
          error={err("note")}
          counter={<Counter value={values.note} max={LIMITS.note} />}
        >
          <textarea
            id="f-note"
            rows={3}
            value={values.note}
            onChange={(e) => setValue("note", e.target.value)}
            aria-invalid={!!err("note")}
            aria-describedby={describe("note")}
            className={inputClass(err("note"))}
          />
        </Field>

        <Field
          name="creatorName"
          label="Nama atau nama panggilan"
          error={err("creatorName")}
          counter={<Counter value={values.creatorName} max={LIMITS.creatorName} />}
        >
          <input
            id="f-creatorName"
            type="text"
            value={values.creatorName}
            onChange={(e) => setValue("creatorName", e.target.value)}
            autoComplete="off"
            aria-invalid={!!err("creatorName")}
            aria-describedby={describe("creatorName")}
            className={inputClass(err("creatorName"))}
          />
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">Orang menghubungimu lewat</legend>
          <div className="grid grid-cols-2 gap-2">
            {CONTACT_TYPES.map((c) => (
              <label
                key={c}
                className={`flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-base font-semibold ${
                  values.contactType === c
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <input
                  type="radio"
                  name="contactType"
                  value={c}
                  checked={values.contactType === c}
                  onChange={() => {
                    setValue("contactType", c);
                    setErrors((prev) => ({ ...prev, contactValue: undefined }));
                  }}
                  className="sr-only"
                />
                {CONTACT_LABELS[c]}
              </label>
            ))}
          </div>
          <Field
            name="contactValue"
            label={values.contactType === "whatsapp" ? "Nomor WhatsApp" : "Username Instagram"}
            error={err("contactValue")}
            hint="Tidak ditampilkan di kartu."
          >
            <input
              id="f-contactValue"
              type={values.contactType === "whatsapp" ? "tel" : "text"}
              inputMode={values.contactType === "whatsapp" ? "tel" : "text"}
              value={values.contactValue}
              onChange={(e) => setValue("contactValue", e.target.value)}
              placeholder={values.contactType === "whatsapp" ? "mis. 0812 3456 7890" : "mis. namakamu"}
              autoComplete="off"
              autoCapitalize="none"
              aria-invalid={!!err("contactValue")}
              aria-describedby={describe("contactValue")}
              className={inputClass(err("contactValue"))}
            />
          </Field>
        </fieldset>

        <button type="submit" className={primaryButton}>
          Lanjut ke pratinjau
        </button>
      </form>
    </main>
  );
}
