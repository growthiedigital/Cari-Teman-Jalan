"use client";

/* eslint-disable @next/next/no-img-element -- gambar dari API, bukan aset statis untuk next/image */
import { useEffect, useState } from "react";

import { RatioToggle } from "@/components/ratio-toggle";
import {
  CARD_THEMES,
  THEMES,
  type CardRatio,
  type CardTheme,
} from "@/lib/card/spec";

const DEBOUNCE_MS = 400;
const THEME_NAMES: Record<CardTheme, string> = { a: "Hangat", b: "Malam" };

type Props = {
  /** Data form lengkap (termasuk `theme`); dikirim ke POST /api/card/preview. */
  payload: Record<string, unknown>;
  theme: CardTheme;
  onThemeChange: (theme: CardTheme) => void;
};

/** Hasil permintaan terakhir, ditandai `key` permintaannya; beda key = masih memuat. */
type Result = { key: string; status: "ready"; src: string } | { key: string; status: "error" };

/**
 * Pratinjau kartu dari renderer yang sama dengan kartu asli. Pilihan rasio
 * hanya mengubah pratinjau; pilihan tema ikut tersimpan lewat `payload`.
 */
export function CardPreview({ payload, theme, onThemeChange }: Props) {
  const [ratio, setRatio] = useState<CardRatio>("4x5");
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const body = JSON.stringify(payload);
  const key = `${ratio}|${attempt}|${body}`;
  const loading = result === null || result.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    // Debounce: berpindah-pindah tema/rasio dengan cepat hanya memicu satu permintaan.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/card/preview?r=${ratio}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResult({ key, status: "ready", src: objectUrl });
      } catch {
        if (!controller.signal.aborted) setResult({ key, status: "error" });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [body, ratio, attempt, key]);

  const aspect = ratio === "9x16" ? "aspect-[9/16]" : "aspect-[4/5]";

  return (
    <section aria-label="Pratinjau kartu" className="flex flex-col gap-4">
      <div
        className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 ${aspect} ${
          ratio === "9x16" ? "max-w-[15rem]" : "max-w-xs"
        }`}
      >
        {!loading && result?.status === "ready" && (
          <img
            src={result.src}
            alt="Pratinjau kartu trip"
            className="h-full w-full object-cover"
          />
        )}
        {loading && (
          <p
            role="status"
            className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-zinc-500"
          >
            Menyiapkan kartu...
          </p>
        )}
        {!loading && result?.status === "error" && (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center text-sm"
          >
            <p>Pratinjau kartu belum bisa dimuat. Kamu tetap bisa kirim trip-nya.</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-lg border border-zinc-400 px-3 py-1.5 font-semibold"
            >
              Coba lagi
            </button>
          </div>
        )}
      </div>

      <RatioToggle value={ratio} onChange={setRatio} />

      <div className="flex flex-col gap-2">
        <span id="l-theme" className="text-sm font-semibold">
          Warna kartu
        </span>
        <div role="radiogroup" aria-labelledby="l-theme" className="grid grid-cols-2 gap-2">
          {CARD_THEMES.map((t) => {
            const palette = THEMES[t];
            const selected = theme === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onThemeChange(t)}
                className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left font-semibold ${
                  selected
                    ? "border-zinc-900 dark:border-white"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-zinc-300"
                  style={{ backgroundColor: palette.bg }}
                >
                  <span
                    className="ml-auto h-full w-1/2"
                    style={{ backgroundColor: palette.rencana.accent }}
                  />
                </span>
                {THEME_NAMES[t]}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
