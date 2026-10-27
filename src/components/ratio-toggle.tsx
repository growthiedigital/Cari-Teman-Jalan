"use client";

import { CARD_RATIOS, RATIO_LABELS, type CardRatio } from "@/lib/card/spec";

type Props = {
  value: CardRatio;
  onChange: (ratio: CardRatio) => void;
};

/** Pilihan rasio kartu (9:16 / 4:5), dipakai di pratinjau form dan layar sukses. */
export function RatioToggle({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Rasio kartu" className="grid grid-cols-2 gap-2">
      {CARD_RATIOS.map((ratio) => {
        const selected = value === ratio;
        return (
          <button
            key={ratio}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(ratio)}
            className={`rounded-xl border px-4 py-3 text-base font-semibold ${
              selected
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {RATIO_LABELS[ratio]}
            <span className="ml-1.5 text-sm font-normal opacity-70">
              {ratio === "9x16" ? "Story" : "Feed"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
