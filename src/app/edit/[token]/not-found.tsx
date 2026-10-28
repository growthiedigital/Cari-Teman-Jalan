import Link from "next/link";

import { ForgetTrip } from "./forget-trip";

// Netral: tidak membedakan token yang salah dari trip yang sudah dihapus.
export default function EditNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Link edit tidak valid</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Link edit tidak valid atau trip sudah dihapus. Cek lagi link yang kamu simpan.
      </p>
      <ForgetTrip />
      <Link href="/trip-saya" className="font-semibold underline">
        Trip saya
      </Link>
      <Link href="/" className="font-semibold underline">
        Ke halaman awal
      </Link>
    </main>
  );
}
