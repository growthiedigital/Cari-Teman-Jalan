"use client";

import { useState, type ReactNode } from "react";

import {
  CONTACT_LABELS,
  CONTACT_TYPES,
  LIMITS,
  TAGS,
  type TripErrors,
  type TripField,
  type TripType,
} from "@/lib/trip/constants";
import type { FormValues } from "@/lib/trip/form-values";
import { textLength } from "@/lib/trip/schema";

/*
 * Bagian form trip yang dipakai bersama oleh /buat (mode buat) dan /edit/[token]
 * (mode edit): kelas gaya, kolom isian, urutan fokus error, dan state form.
 */

export const inputClass = (error?: string) =>
  `w-full rounded-xl border bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-2 focus:outline-offset-2 focus:outline-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:outline-zinc-100 ${
    error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"
  }`;

export const primaryButton =
  "w-full rounded-xl bg-zinc-900 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900";
export const secondaryButton =
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

// Urutan field di layar; dipakai untuk memfokuskan error pertama.
export const FIELD_ORDER: TripField[] = [
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

export function focusFirstError(found: TripErrors) {
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

/** State isian + error; mengubah sebuah field menghapus error field itu. */
export function useTripFormState(initial: FormValues) {
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<TripErrors>({});

  function setValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const cleared: TripErrors = { ...prev, [key]: undefined };
      // Ganti jenis kontak membuat error nilai kontak tidak relevan lagi.
      if (key === "contactType") cleared.contactValue = undefined;
      return cleared;
    });
  }

  return { values, errors, setErrors, setValue };
}

type TripFieldsProps = {
  type: TripType;
  values: FormValues;
  errors: TripErrors;
  setValue: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  /** Tanggal paling awal yang ditawarkan pemilih tanggal (hari ini; di edit bisa lebih awal). */
  startMin: string;
  months: { value: string; label: string }[];
  contactHint: string;
};

/** Semua kolom isian trip, dari tujuan sampai kontak. Tanpa tombol dan tanpa pilihan jenis. */
export function TripFields({
  type,
  values,
  errors,
  setValue,
  startMin,
  months,
  contactHint,
}: TripFieldsProps) {
  const isRencana = type === "rencana";
  const err = (field: TripField) => errors[field];
  const describe = (field: TripField) => (err(field) ? `e-${field}` : undefined);

  function toggleTag(value: string) {
    const has = values.tags.includes(value);
    if (!has && values.tags.length >= LIMITS.tagsMax) return;
    setValue(
      "tags",
      has ? values.tags.filter((t) => t !== value) : [...values.tags, value],
    );
  }

  return (
    <>
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
              min={startMin}
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
              min={values.startDate || startMin}
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
                onChange={() => setValue("contactType", c)}
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
          hint={contactHint}
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
    </>
  );
}
