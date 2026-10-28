import Link from "next/link";

// Halaman 404 untuk alamat yang tidak ada (mis. /trip tanpa ID). Menggantikan
// halaman bawaan Next.js yang berbahasa Inggris.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Alamat yang kamu buka tidak ada. Cek lagi link yang kamu terima.
      </p>
      <Link href="/" className="font-semibold underline">
        Ke halaman awal
      </Link>
    </main>
  );
}
