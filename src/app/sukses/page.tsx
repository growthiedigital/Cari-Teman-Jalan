import Link from "next/link";

import { isValidTripId } from "@/lib/trip/id";

export const metadata = {
  title: "Trip tersimpan | Trip Card",
};

export default async function SuksesPage({
  searchParams,
}: PageProps<"/sukses">) {
  const { id } = await searchParams;
  const tripId = isValidTripId(id) ? id : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      {tripId ? (
        <>
          <h1 className="text-3xl font-bold tracking-tight">Trip kamu sudah tersimpan</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            ID trip:{" "}
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
              {tripId}
            </span>
          </p>
          <Link
            href={`/trip/${tripId}`}
            prefetch={false}
            className="rounded-xl bg-zinc-900 px-4 py-3.5 text-center text-base font-semibold text-white dark:bg-white dark:text-zinc-900"
          >
            Lihat halaman trip
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold tracking-tight">Belum ada trip</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Halaman ini muncul setelah kamu menyimpan trip.
          </p>
          <Link href="/buat" className="font-semibold underline">
            Buat trip
          </Link>
        </>
      )}
    </main>
  );
}
