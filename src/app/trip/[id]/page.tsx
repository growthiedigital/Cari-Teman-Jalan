import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cache, type ReactNode } from "react";

import { cardImageUrl, siteUrlFromHeaders, tripUrl } from "@/lib/card/site-url";
import { getCardDimensions } from "@/lib/card/spec";

import { TAG_LABELS, type TripType } from "@/lib/trip/constants";
import { formatBudgetPerPerson, formatTripTime } from "@/lib/trip/format";
import { getPublicTrip } from "@/lib/trip/queries";
import { disabledContactLabel, tripStatus } from "@/lib/trip/status";
import { ReportContactFooter } from "@/components/report-contact-footer";

// Trip bisa diedit/dihapus kapan saja: jangan di-cache statis.
export const dynamic = "force-dynamic";

// Dipakai bersama oleh generateMetadata dan halaman: satu query per permintaan.
const loadTrip = cache(getPublicTrip);

export async function generateMetadata({
  params,
}: PageProps<"/trip/[id]">): Promise<Metadata> {
  const { id } = await params;
  const trip = await loadTrip(id);
  // `noindex` tidak menghalangi crawler pratinjau link (WhatsApp, Instagram).
  const robots = { index: false, follow: false };
  if (!trip) return { title: "Trip tidak ditemukan | Trip Card", robots };

  const siteUrl = siteUrlFromHeaders(await headers());
  const time = formatTripTime(trip);
  const description = time ? `${trip.destination} · ${time}` : trip.destination;
  const { width, height } = getCardDimensions("4x5", "og");
  const image = {
    url: cardImageUrl(siteUrl, trip.id, "4x5", "og"),
    width,
    height,
    alt: `Kartu trip: ${trip.title}`,
  };

  return {
    metadataBase: new URL(siteUrl),
    title: `${trip.title} | Trip Card`,
    description,
    robots,
    openGraph: {
      type: "website",
      title: trip.title,
      description,
      url: tripUrl(siteUrl, trip.id),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: trip.title,
      description,
      images: [image.url],
    },
  };
}

const TYPE_BADGE: Record<TripType, { label: string; className: string }> = {
  rencana: {
    label: "Sudah ada rencana",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  niat: {
    label: "Cari peminat",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
};

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
        {label}
      </h2>
      {children}
    </section>
  );
}

export default async function TripPage({ params }: PageProps<"/trip/[id]">) {
  const { id } = await params;
  const trip = await loadTrip(id);
  if (!trip) notFound();

  const badge = TYPE_BADGE[trip.type];
  // Dihitung saat dirender (halaman dinamis), jadi tidak pernah basi.
  const status = tripStatus(trip);
  const time = formatTripTime(trip);
  const story = trip.type === "rencana" ? trip.itinerary : trip.intention;
  const storyLabel = trip.type === "rencana" ? "Itinerary" : "Niat singkat";

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 pt-8">
        <header className="flex flex-col gap-3">
          {(status.isExpired || status.isFull) && (
            // Kotak bergaris tegas (bukan pil) supaya tidak tertukar dengan
            // penanda jenis trip di bawahnya.
            <ul aria-label="Status trip" className="flex flex-wrap gap-2">
              {status.isExpired && (
                <li className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white dark:bg-zinc-200 dark:text-zinc-900">
                  Sudah lewat
                </li>
              )}
              {status.isFull && (
                <li className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white dark:bg-red-500 dark:text-red-950">
                  Sudah penuh
                </li>
              )}
            </ul>
          )}
          <span
            className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
          <h1 className="break-words text-3xl font-bold leading-tight tracking-tight">
            {trip.title}
          </h1>
          <p className="break-words text-lg text-zinc-600 dark:text-zinc-400">
            {trip.destination}
          </p>
        </header>

        <dl className="grid grid-cols-1 gap-4 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
          {time && (
            <div>
              <dt className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                Waktu
              </dt>
              <dd className="text-base font-medium">{time}</dd>
            </div>
          )}
          {trip.buddies_wanted !== null && (
            <div>
              <dt className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                Teman jalan
              </dt>
              <dd className="text-base font-medium">Cari {trip.buddies_wanted} teman</dd>
            </div>
          )}
          {trip.budget !== null && (
            <div>
              <dt className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                Budget
              </dt>
              <dd className="text-base font-medium">
                {formatBudgetPerPerson(trip.budget)}
              </dd>
            </div>
          )}
        </dl>

        <ul className="flex flex-wrap gap-2" aria-label="Selera">
          {trip.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
            >
              {TAG_LABELS[tag] ?? tag}
            </li>
          ))}
        </ul>

        {story && (
          <Section label={storyLabel}>
            <p className="whitespace-pre-line break-words text-base leading-7">{story}</p>
          </Section>
        )}

        {trip.note && (
          <Section label="Catatan">
            <p className="whitespace-pre-line break-words text-base leading-7">
              {trip.note}
            </p>
          </Section>
        )}

        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Dibuat oleh <span className="font-semibold">{trip.creator_name}</span>
        </p>

        {/* Tautan biasa (bukan next/link): tidak di-prefetch, jadi tidak
            menyentuh database sebelum diklik. Tanpa nomor/handle di sini. */}
        <div className="sticky bottom-0 -mx-5 mt-auto border-t border-zinc-200 bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-zinc-800">
          {status.canContact ? (
            <a
              href={`/go/${trip.id}`}
              rel="nofollow"
              className="flex min-h-14 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-lg font-semibold text-white dark:bg-white dark:text-zinc-900"
            >
              Tertarik / Hubungi
            </a>
          ) : (
            // Bukan tautan (tanpa href ke /go): trip penuh/lewat tidak bisa dihubungi.
            <button
              type="button"
              aria-disabled="true"
              className="flex min-h-14 w-full cursor-not-allowed items-center justify-center rounded-xl border-2 border-dashed border-zinc-400 bg-zinc-200 px-4 text-lg font-semibold text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {disabledContactLabel(status)}
            </button>
          )}
        </div>
      </main>

      <ReportContactFooter />
    </div>
  );
}
