"use client";

/* eslint-disable @next/next/no-img-element -- gambar dari API, bukan aset statis untuk next/image */
import Link from "next/link";
import { useState } from "react";

import { RatioToggle } from "@/components/ratio-toggle";
import { DEFAULT_RATIO, type CardRatio } from "@/lib/card/spec";
import { tripUrl } from "@/lib/card/site-url";
import { copyText } from "@/lib/copy-text";

type Props = {
  id: string;
  siteUrl: string;
};

const COPIED_MS = 2000;

const primaryButton =
  "flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3.5 text-center text-base font-semibold text-white dark:bg-white dark:text-zinc-900";
const secondaryButton =
  "flex w-full items-center justify-center rounded-xl border border-zinc-300 px-4 py-3.5 text-center text-base font-semibold dark:border-zinc-700";

export function SuccessCard({ id, siteUrl }: Props) {
  const [ratio, setRatio] = useState<CardRatio>(DEFAULT_RATIO);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const cardSrc = `/api/card/${id}?r=${ratio}`;
  const downloadHref = `${cardSrc}&download=1`;

  function changeRatio(next: CardRatio) {
    if (next === ratio) return;
    setRatio(next);
    setLoaded(false);
    setFailed(false);
  }

  // Tahap 6: catat event `card_downloaded` di sini (klik "Unduh gambar").
  function handleDownload() {}

  // Tahap 6: catat event `link_copied` di sini (setelah berhasil menyalin).
  async function handleCopy() {
    const ok = await copyText(tripUrl(siteUrl, id));
    setCopyState(ok ? "copied" : "failed");
    setTimeout(() => setCopyState("idle"), COPIED_MS);
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 ${
          ratio === "9x16" ? "aspect-[9/16] max-w-[15rem]" : "aspect-[4/5] max-w-xs"
        }`}
      >
        {!failed && (
          <img
            key={ratio}
            // Gambar bisa selesai dimuat sebelum hydration, sehingga onLoad terlewat.
            ref={(el) => {
              if (el?.complete) {
                if (el.naturalWidth > 0) setLoaded(true);
                else setFailed(true);
              }
            }}
            src={cardSrc}
            alt="Kartu trip kamu"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
        {!loaded && !failed && (
          <p
            role="status"
            className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500"
          >
            Menyiapkan kartu...
          </p>
        )}
        {failed && (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center text-sm"
          >
            <p>Kartu belum bisa dimuat.</p>
            <button
              type="button"
              onClick={() => setFailed(false)}
              className="rounded-lg border border-zinc-400 px-3 py-1.5 font-semibold"
            >
              Coba lagi
            </button>
          </div>
        )}
      </div>

      <RatioToggle value={ratio} onChange={changeRatio} />

      <div className="flex flex-col gap-3">
        <a href={downloadHref} download onClick={handleDownload} className={primaryButton}>
          Unduh gambar
        </a>
        <button type="button" onClick={handleCopy} className={secondaryButton}>
          Salin link
        </button>
        <p role="status" aria-live="polite" className="min-h-5 text-center text-sm font-medium">
          {copyState === "copied" && "Link disalin"}
          {copyState === "failed" && (
            <span className="text-red-600 dark:text-red-400">
              Tidak bisa menyalin. Salin manual: {tripUrl(siteUrl, id)}
            </span>
          )}
        </p>
        <Link href={`/trip/${id}`} prefetch={false} className={secondaryButton}>
          Lihat halaman trip
        </Link>
      </div>
    </div>
  );
}
