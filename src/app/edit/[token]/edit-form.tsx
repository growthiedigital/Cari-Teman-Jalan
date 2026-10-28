"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  TripFields,
  focusFirstError,
  primaryButton,
  secondaryButton,
  useTripFormState,
} from "@/components/trip-fields";
import { TRIP_TYPE_LABELS, type TripErrors, type TripType } from "@/lib/trip/constants";
import type { FormValues } from "@/lib/trip/form-values";
import { removeMyTrip, updateMyTripTitle } from "@/lib/trip/local-storage";
import { validateTripEdit, type StoredTripTiming } from "@/lib/trip/schema";
import { isExpired } from "@/lib/trip/status";

import { StatusSection } from "./status-section";

type Props = {
  token: string;
  tripId: string;
  type: TripType;
  initialValues: FormValues;
  stored: StoredTripTiming;
  today: string;
  /** Waktu server saat halaman dirender (ISO), supaya "sudah lewat" sama di server dan klien. */
  nowIso: string;
  isFull: boolean;
  months: { value: string; label: string }[];
};

const GENERIC_ERROR = "Terjadi kesalahan. Coba lagi beberapa saat lagi.";
const OFFLINE_ERROR = "Tidak bisa terhubung ke server. Periksa koneksi internetmu lalu coba lagi.";
const GONE_ERROR = "Link edit tidak valid atau trip sudah dihapus.";

const CARD_WARNING =
  "Kartu yang sudah kamu unduh atau bagikan tidak ikut berubah. Hanya halaman detail trip yang diperbarui. Pratinjau gambar saat link dibagikan juga tetap memakai kartu lama.";

const dangerButton =
  "w-full rounded-xl bg-red-600 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50";

function Alert({ children, tone }: { children: React.ReactNode; tone: "error" | "warn" | "ok" }) {
  const styles = {
    error: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    warn: "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    ok: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  };
  return (
    <p
      role={tone === "warn" ? undefined : tone === "ok" ? "status" : "alert"}
      className={`rounded-xl px-4 py-3 text-sm font-medium ${styles[tone]}`}
    >
      {children}
    </p>
  );
}

export function EditForm({
  token,
  tripId,
  type,
  initialValues,
  stored,
  today,
  nowIso,
  isFull,
  months,
}: Props) {
  const { values, errors, setErrors, setValue } = useTripFormState(initialValues);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Tanggal pulang yang tersimpan: berubah setelah simpan, memengaruhi "Sudah lewat".
  const [savedEndDate, setSavedEndDate] = useState(stored.endDate);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  const shell = "mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaved(false);
    setSubmitError(null);

    const body = { ...values, type };
    const check = validateTripEdit(body, stored);
    if (!check.ok) {
      setErrors(check.errors);
      focusFirstError(check.errors);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      // Token di body, bukan di URL atau query.
      const response = await fetch("/api/trips/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...body }),
      });
      const data: unknown = await response.json().catch(() => null);
      const result = (data ?? {}) as { title?: unknown; message?: unknown; errors?: TripErrors };

      if (response.status === 400 && result.errors) {
        setErrors(result.errors);
        focusFirstError(result.errors);
        return;
      }
      if (response.status === 404) {
        setSubmitError(GONE_ERROR);
        return;
      }
      if (!response.ok) {
        setSubmitError(
          response.status < 500 && typeof result.message === "string"
            ? result.message
            : GENERIC_ERROR,
        );
        return;
      }
      if (typeof result.title === "string") updateMyTripTitle(tripId, result.title);
      setSavedEndDate(type === "rencana" ? body.endDate || null : null);
      setSaved(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError(OFFLINE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/trips/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      // 404 = sudah terhapus (mis. dari perangkat lain); hasilnya sama bagi pengguna.
      if (!response.ok && response.status !== 404) {
        setDeleteError(GENERIC_ERROR);
        return;
      }
      removeMyTrip(tripId);
      setDeleted(true);
      window.scrollTo(0, 0);
    } catch {
      setDeleteError(OFFLINE_ERROR);
    } finally {
      setDeleting(false);
    }
  }

  if (deleted) {
    return (
      <main className={shell}>
        <h1 className="text-3xl font-bold tracking-tight">Trip sudah dihapus</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Trip dihapus permanen. Link publiknya sudah tidak berfungsi dan trip ini sudah
          dibuang dari daftar di perangkat ini.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/trip-saya" className={`${secondaryButton} text-center`}>
            Trip saya
          </Link>
          <Link href="/buat" className={`${primaryButton} block text-center`}>
            Buat trip baru
          </Link>
        </div>
      </main>
    );
  }

  const startMin =
    stored.startDate && stored.startDate < today ? stored.startDate : today;
  const formError = errors.form ?? errors.type;
  const expired = isExpired({ type, end_date: savedEndDate }, new Date(nowIso));

  return (
    <main className={shell}>
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Edit trip</h1>
        <p className="flex items-center justify-between gap-3 rounded-xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-900">
          <span className="font-semibold">{TRIP_TYPE_LABELS[type]}</span>
          <span className="text-zinc-500">Jenis trip tidak bisa diubah</span>
        </p>
        <Alert tone="warn">{CARD_WARNING}</Alert>
      </header>

      {saved && (
        <div className="flex flex-col gap-2">
          <Alert tone="ok">Perubahan tersimpan</Alert>
          <Link href={`/trip/${tripId}`} prefetch={false} className="font-semibold underline">
            Lihat halaman trip
          </Link>
        </div>
      )}

      <StatusSection token={token} initialIsFull={isFull} expired={expired} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {formError && <Alert tone="error">{formError}</Alert>}

        <TripFields
          type={type}
          values={values}
          errors={errors}
          setValue={setValue}
          startMin={startMin}
          months={months}
          contactHint="Hanya kamu yang melihat isian ini. Tidak ditampilkan di halaman publik."
        />

        <Alert tone="warn">{CARD_WARNING}</Alert>
        {submitError && <Alert tone="error">{submitError}</Alert>}
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "Menyimpan..." : "Simpan perubahan"}
        </button>
      </form>

      <section className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="w-full rounded-xl border border-red-500 px-4 py-3.5 text-base font-semibold text-red-600 dark:text-red-400"
          >
            Hapus trip
          </button>
        ) : (
          <div
            role="alertdialog"
            aria-labelledby="hapus-judul"
            aria-describedby="hapus-isi"
            className="flex flex-col gap-3 rounded-2xl border-2 border-red-500 p-4"
          >
            <h2 id="hapus-judul" className="text-lg font-bold">
              Hapus trip ini?
            </h2>
            <p id="hapus-isi" className="text-sm">
              Tindakan ini tidak bisa dibatalkan. Trip dihapus permanen dan link publik
              (halaman trip, tombol Hubungi, dan gambar kartu) berhenti bekerja.
            </p>
            {deleteError && <Alert tone="error">{deleteError}</Alert>}
            <button type="button" onClick={handleDelete} disabled={deleting} className={dangerButton}>
              {deleting ? "Menghapus..." : "Ya, hapus permanen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false);
                setDeleteError(null);
              }}
              disabled={deleting}
              className={secondaryButton}
            >
              Batal
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
