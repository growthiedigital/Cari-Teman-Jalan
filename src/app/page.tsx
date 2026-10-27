import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight">Trip Card</h1>
      <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
        Buat kartu trip untuk cari teman jalan, lalu bagikan ke media sosial.
      </p>
      <Link
        href="/buat"
        className="rounded-xl bg-zinc-900 px-4 py-3.5 text-center text-base font-semibold text-white dark:bg-white dark:text-zinc-900"
      >
        Buat trip
      </Link>
    </main>
  );
}
