"use client";

import Link from "next/link";

// Tampilan bila server gagal memuat halaman (mis. database sedang bermasalah).
// Menggantikan halaman galat bawaan Next.js yang berbahasa Inggris. Isi galat
// tidak ditampilkan.
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Halaman belum bisa dimuat</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Terjadi kesalahan di server. Coba lagi beberapa saat lagi.
      </p>
      <button type="button" onClick={() => retry()} className="w-full rounded-xl bg-zinc-900 px-4 py-3.5 text-base font-semibold text-white dark:bg-white dark:text-zinc-900">
        Coba lagi
      </button>
      <Link href="/" className="font-semibold underline">
        Ke halaman awal
      </Link>
    </main>
  );
}
