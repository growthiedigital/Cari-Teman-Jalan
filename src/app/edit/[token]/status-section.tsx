"use client";

import { useState } from "react";

import { primaryButton, secondaryButton } from "@/components/trip-fields";

type Props = {
  token: string;
  initialIsFull: boolean;
  /** Trip sudah lewat (dihitung oleh isExpired); hanya keterangan, bukan tombol. */
  expired: boolean;
};

const GENERIC_ERROR = "Terjadi kesalahan. Coba lagi beberapa saat lagi.";
const OFFLINE_ERROR = "Tidak bisa terhubung ke server. Periksa koneksi internetmu lalu coba lagi.";
const GONE_ERROR = "Link edit tidak valid atau trip sudah dihapus.";

const FULL_DONE =
  "Trip ditandai sudah penuh. Halaman detail menampilkan penanda dan tombol Hubungi dinonaktifkan.";
const REOPENED_DONE =
  "Trip dibuka lagi. Halaman detail tidak lagi menampilkan penanda penuh dan tombol Hubungi aktif kembali.";
const REOPENED_EXPIRED_DONE =
  "Trip dibuka lagi, tetapi tombol Hubungi tetap nonaktif karena trip ini sudah lewat.";

function Pill({ children, tone }: { children: React.ReactNode; tone: "ok" | "full" | "past" }) {
  const styles = {
    ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    full: "bg-red-600 text-white dark:bg-red-500 dark:text-red-950",
    past: "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
  };
  return (
    <li className={`rounded-md px-3 py-1.5 text-sm font-bold ${styles[tone]}`}>{children}</li>
  );
}

/**
 * Bagian "Status trip" di halaman edit, terpisah dari form simpan. Satu tombol
 * membalik `is_full` lewat POST /api/trips/status (token di body). Tidak ada
 * konfirmasi karena bisa dibalik. Status "Sudah lewat" hanya keterangan.
 */
export function StatusSection({ token, initialIsFull, expired }: Props) {
  const [isFull, setIsFull] = useState(initialIsFull);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (pending) return;
    const next = !isFull;
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/trips/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, isFull: next }),
      });
      if (response.status === 404) {
        setError(GONE_ERROR);
        return;
      }
      const data: unknown = await response.json().catch(() => null);
      const saved = (data as { isFull?: unknown } | null)?.isFull;
      if (!response.ok || typeof saved !== "boolean") {
        setError(GENERIC_ERROR);
        return;
      }
      setIsFull(saved);
      setMessage(saved ? FULL_DONE : expired ? REOPENED_EXPIRED_DONE : REOPENED_DONE);
    } catch {
      setError(OFFLINE_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="status-judul"
      className="flex flex-col gap-3 rounded-2xl border border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h2 id="status-judul" className="text-lg font-bold">
        Status trip
      </h2>

      <ul className="flex flex-wrap gap-2" aria-label="Status saat ini">
        {!isFull && !expired && <Pill tone="ok">Masih cari teman</Pill>}
        {isFull && <Pill tone="full">Sudah penuh</Pill>}
        {expired && <Pill tone="past">Sudah lewat</Pill>}
      </ul>

      {expired && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Trip ini sudah lewat karena tanggal pulang sudah berlalu. Status ini otomatis dan
          tidak bisa dimatikan lewat tombol; hilang bila tanggal pulang diubah ke hari ini atau
          lebih baru.
        </p>
      )}

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {isFull || expired
          ? "Di halaman detail, tombol Hubungi dinonaktifkan."
          : "Orang yang membuka halaman detail bisa menekan tombol Hubungi."}
      </p>

      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={isFull ? primaryButton : secondaryButton}
      >
        {pending ? "Menyimpan..." : isFull ? "Buka lagi, masih cari teman" : "Tandai sudah penuh"}
      </button>

      <div aria-live="polite">
        {message && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
