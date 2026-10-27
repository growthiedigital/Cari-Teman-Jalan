import Link from "next/link";

export default function TripNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Trip tidak ditemukan</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Trip tidak ditemukan atau sudah dihapus. Cek lagi link yang kamu terima.
      </p>
      <Link href="/" className="font-semibold underline">
        Ke halaman awal
      </Link>
    </main>
  );
}
