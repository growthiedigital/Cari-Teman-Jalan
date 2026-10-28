"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { sendEvent } from "@/lib/analytics/send-event";
import {
  TripFields,
  focusFirstError,
  primaryButton,
  secondaryButton,
  useTripFormState,
} from "@/components/trip-fields";
import {
  CONTACT_LABELS,
  TAG_LABELS,
  TRIP_TYPE_LABELS,
  TRIP_TYPES,
  type TripErrors,
  type TripType,
} from "@/lib/trip/constants";
import { DEFAULT_THEME, type CardTheme } from "@/lib/card/spec";
import { formatDateId, formatMonthId, formatRupiah } from "@/lib/trip/dates";
import { INITIAL_FORM_VALUES } from "@/lib/trip/form-values";
import { getDeviceId, saveMyTrip, saveSessionBackup } from "@/lib/trip/local-storage";
import { validateTrip, type TripInput } from "@/lib/trip/schema";

import { CardPreview } from "./card-preview";

type Props = {
  today: string;
  months: { value: string; label: string }[];
};

type Step = "type" | "form" | "preview";

const GENERIC_SUBMIT_ERROR = "Terjadi kesalahan. Coba lagi beberapa saat lagi.";

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
  const { values, errors, setErrors, setValue } = useTripFormState(INITIAL_FORM_VALUES);
  const [theme, setTheme] = useState<CardTheme>(DEFAULT_THEME);
  const [preview, setPreview] = useState<TripInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // `form_opened` dicatat sekali per pemuatan halaman: jenis pertama yang
  // dipilih; berpindah jenis tidak mencatat ulang.
  const formOpenedSent = useRef(false);

  function chooseType(next: TripType) {
    if (!formOpenedSent.current) {
      formOpenedSent.current = true;
      sendEvent({ event: "form_opened", tripType: next });
    }
    setType(next);
    setStep("form");
    window.scrollTo(0, 0);
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
      // Cadangan bila localStorage gagal: dibaca /sukses untuk menampilkan link edit.
      saveSessionBackup({ id: body.id, editToken: body.editToken });
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
            label="Jumlah teman yang dicari"
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

        <TripFields
          type={type as TripType}
          values={values}
          errors={errors}
          setValue={setValue}
          startMin={today}
          months={months}
          contactHint="Tidak ditampilkan di kartu maupun halaman trip. Orang menghubungimu lewat tombol Hubungi."
        />

        <button type="submit" className={primaryButton}>
          Lanjut ke pratinjau
        </button>
      </form>
    </main>
  );
}
