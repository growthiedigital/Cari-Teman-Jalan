"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import { formatDateId, todayJakarta } from "@/lib/trip/dates";
import { editPath } from "@/lib/trip/edit-link";
import { parseMyTrips, readMyTripsRaw, type MyTrip } from "@/lib/trip/local-storage";

const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

function createdLabel(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : formatDateId(todayJakarta(date));
}

const primaryLink =
  "flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3.5 text-center text-base font-semibold text-white dark:bg-white dark:text-zinc-900";

function TripRow({ trip }: { trip: MyTrip }) {
  const created = createdLabel(trip.createdAt);
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-0.5">
        <h2 className="break-words text-lg font-bold leading-snug">{trip.title}</h2>
        {created && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Dibuat {created}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* prefetch dimatikan: halaman edit membaca database dan memakai token. */}
        <Link
          href={editPath(trip.editToken)}
          prefetch={false}
          className="flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          Edit
        </Link>
        <Link
          href={`/trip/${trip.id}`}
          prefetch={false}
          className="flex items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-base font-semibold dark:border-zinc-700"
        >
          Lihat halaman
        </Link>
      </div>
    </li>
  );
}

/** Daftar dari localStorage saja (tanpa panggilan server). Rusak/tidak tersedia -> kosong. */
export function MyTrips() {
  const raw = useSyncExternalStore(subscribeStorage, readMyTripsRaw, () => undefined);
  const trips = useMemo(
    () => (raw === undefined ? null : parseMyTrips(raw).reverse()),
    [raw],
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Trip saya</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Daftar ini hanya ada di browser ini dan akan hilang kalau data browser dibersihkan.
          Simpan link edit trip kamu untuk berjaga-jaga.
        </p>
      </header>

      {trips === null ? null : trips.length === 0 ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <p className="text-lg font-semibold">Belum ada trip di perangkat ini</p>
          <Link href="/buat" className={primaryLink}>
            Buat trip
          </Link>
        </section>
      ) : (
        <ul className="flex flex-col gap-4">
          {trips.map((trip) => (
            <TripRow key={trip.id} trip={trip} />
          ))}
        </ul>
      )}

      <Link href="/" className="text-center font-semibold underline">
        Ke halaman awal
      </Link>
    </main>
  );
}
