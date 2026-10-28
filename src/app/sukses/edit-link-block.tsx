"use client";

import { useState, useSyncExternalStore } from "react";

import { copyText } from "@/lib/copy-text";
import { editUrl } from "@/lib/trip/edit-link";
import { findEditToken } from "@/lib/trip/local-storage";

type Props = {
  id: string;
  siteUrl: string;
};

const COPIED_MS = 2000;

// Penyimpanan browser tidak berubah selama halaman ini terbuka; tidak perlu berlangganan.
const subscribeNone = () => () => {};

/**
 * Link edit rahasia. Token dibaca dari localStorage (atau cadangan
 * sessionStorage), tidak pernah dari URL. `undefined` = belum dihidrasi,
 * `null` = tidak ditemukan.
 */
export function EditLinkBlock({ id, siteUrl }: Props) {
  const token = useSyncExternalStore(
    subscribeNone,
    () => findEditToken(id),
    () => undefined,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  if (token === undefined) return null;

  if (token === null) {
    return (
      <section
        role="alert"
        className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
      >
        <h2 className="text-base font-bold">Link edit tidak bisa ditampilkan</h2>
        <p>
          Link edit tidak dapat ditampilkan di perangkat ini (penyimpanan browser tidak
          tersedia). Trip tetap tersimpan dan halaman publiknya berfungsi, tetapi kamu
          tidak bisa mengeditnya. Kalau perlu, minta penghapusan lewat kontak di bagian
          bawah halaman ini.
        </p>
      </section>
    );
  }

  const link = editUrl(siteUrl, token);

  async function handleCopy() {
    const ok = await copyText(link);
    setCopyState(ok ? "copied" : "failed");
    setTimeout(() => setCopyState("idle"), COPIED_MS);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="text-base font-bold">Link edit (rahasia)</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Simpan link ini kalau mau mengedit dari perangkat lain.
      </p>
      <p className="break-all rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs dark:bg-zinc-900">
        {link}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Siapa pun yang memegang link ini bisa mengubah atau menghapus trip. Jangan dibagikan.
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className="flex w-full items-center justify-center rounded-xl border border-zinc-300 px-4 py-3.5 text-center text-base font-semibold dark:border-zinc-700"
      >
        Salin link edit
      </button>
      <p role="status" aria-live="polite" className="min-h-5 text-center text-sm font-medium">
        {copyState === "copied" && "Link disalin"}
        {copyState === "failed" && (
          <span className="text-red-600 dark:text-red-400">
            Tidak bisa menyalin. Salin manual dari kotak di atas.
          </span>
        )}
      </p>
    </section>
  );
}
