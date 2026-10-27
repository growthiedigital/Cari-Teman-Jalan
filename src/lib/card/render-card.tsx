/* eslint-disable @next/next/no-img-element -- JSX ini dirender satori ke PNG, bukan halaman Next */
import { ImageResponse } from "next/og";
import type { CSSProperties, ReactNode } from "react";

import { TAG_LABELS } from "@/lib/trip/constants";
import { formatTripTime } from "@/lib/trip/format";

import { CARD_FONT_FAMILY, loadCardFonts } from "./fonts";
import { createQrImage } from "./qr";
import { shortUrl } from "./site-url";
import type { CardSnapshot } from "./snapshot";
import {
  THEMES,
  destinationTier,
  getCardDimensions,
  getCardLayout,
  sanitizeCardText,
  tierFor,
  timeTier,
  titleIncludesDestination,
  titleTier,
  urlTier,
  type CardRatio,
  type CardSize,
  type TextTier,
  type ThemePalette,
} from "./spec";

export type RenderCardOptions = {
  ratio: CardRatio;
  size: CardSize;
  /** URL halaman detail trip; dipakai untuk QR dan teks URL pendek. */
  url: string;
  /** Header respons tambahan. Kunci HARUS huruf kecil (lihat catatan di bawah). */
  headers?: Record<string, string>;
};

/**
 * Render kartu trip menjadi PNG. Murni terhadap masukannya: tidak membaca
 * database, jadi bisa diuji dengan snapshot tiruan.
 *
 * CATATAN: ImageResponse menyebar `options.headers` ke objek yang sudah
 * berisi `cache-control` huruf kecil. Kunci dengan huruf besar-kecil berbeda
 * (mis. "Cache-Control") akan DIGABUNG, bukan menimpa. Karena itu kunci
 * dipaksa huruf kecil di sini.
 */
export async function renderCard(
  snapshot: CardSnapshot,
  options: RenderCardOptions,
): Promise<ImageResponse> {
  const { width, height, scale } = getCardDimensions(options.ratio, options.size);
  const fonts = await loadCardFonts();

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(options.headers ?? {})) {
    headers[key.toLowerCase()] = value;
  }

  return new ImageResponse(
    <CardView
      snapshot={snapshot}
      ratio={options.ratio}
      scale={scale}
      width={width}
      height={height}
      url={options.url}
    />,
    { width, height, fonts, headers },
  );
}

// ---------------------------------------------------------------------------
// Tampilan
// ---------------------------------------------------------------------------
type ViewProps = {
  snapshot: CardSnapshot;
  ratio: CardRatio;
  scale: number;
  width: number;
  height: number;
  url: string;
};

function CardView({ snapshot, ratio, scale, width, height, url }: ViewProps) {
  /** Satuan dasar (lebar 1080) -> piksel sesuai skala. Minimal 1 supaya garis tipis tidak hilang. */
  const u = (n: number) => Math.max(1, Math.round(n * scale));
  const theme = THEMES[snapshot.theme];
  const isRencana = snapshot.type === "rencana";
  const accent = isRencana ? theme.rencana : theme.niat;
  const layout = getCardLayout(ratio);
  const pad = layout.padding;

  // lineClamp di satori hanya bekerja pada kotak teks bertipe block (bukan flex).
  const clamp = (tier: TextTier): CSSProperties => ({
    display: "block",
    fontSize: u(tier.fontSize),
    lineClamp: tier.maxLines,
    textOverflow: "ellipsis",
    wordBreak: "break-word",
  });

  const title = sanitizeCardText(snapshot.title) || "Trip";
  const destination = sanitizeCardText(snapshot.destination) || "Trip";
  const showDestination = !titleIncludesDestination(title, destination);
  const time = formatTripTime(snapshot) ?? "";
  const timeStyle = clamp(tierFor(timeTier, time));
  const tags = snapshot.tags.map((t) => TAG_LABELS[t] ?? t);

  const qr = createQrImage(url);
  // Ukuran QR kelipatan bulat dari jumlah modul: tepi modul tajam di piksel.
  const qrPx = qr.modules * Math.max(2, Math.floor(u(layout.qr) / qr.modules));
  const urlText = shortUrl(url);

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: `"${CARD_FONT_FAMILY}"`,
      }}
    >
      {/* Hiasan datar (tanpa gradien/gambar) */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: -u(220),
          right: -u(200),
          width: u(640),
          height: u(640),
          borderRadius: 9999,
          backgroundColor: accent.accent,
          opacity: 0.16,
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: -u(260),
          left: -u(240),
          width: u(600),
          height: u(600),
          borderRadius: 9999,
          backgroundColor: accent.accent,
          opacity: 0.1,
        }}
      />
      {/* Bingkai: garis penuh untuk "rencana", putus-putus untuk "niat" (SVG, karena
          satori menggambar borderStyle dashed sebagai garis penuh) */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", top: 0, left: 0, opacity: 0.6 }}
      >
        <rect
          x={u(30)}
          y={u(30)}
          width={width - u(60)}
          height={height - u(60)}
          rx={u(44)}
          fill="none"
          stroke={accent.accent}
          strokeWidth={u(5)}
          strokeDasharray={isRencana ? undefined : `${u(28)} ${u(20)}`}
        />
      </svg>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: u(layout.gap),
          width: "100%",
          height: "100%",
          paddingTop: u(pad.top),
          paddingBottom: u(pad.bottom),
          paddingLeft: u(pad.side),
          paddingRight: u(pad.side),
        }}
      >
        {/* Atas: penanda jenis */}
        <div style={{ display: "flex" }}>
          <TypeBadge isRencana={isRencana} theme={theme} u={u} />
        </div>

        {/* Tengah: judul, waktu, teman, tag */}
        <div style={{ display: "flex", flexDirection: "column", gap: u(layout.gap) }}>
          <div style={{ display: "flex", flexDirection: "column", gap: u(20) }}>
            <div
              style={{
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: -u(1),
                ...clamp(tierFor(titleTier, title)),
              }}
            >
              {title}
            </div>
            {showDestination && (
              <div
                style={{
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: accent.accent,
                  ...clamp(tierFor(destinationTier, destination)),
                }}
              >
                {destination}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: u(28),
              paddingTop: u(30),
              paddingBottom: u(30),
              paddingLeft: u(36),
              paddingRight: u(36),
              borderRadius: u(28),
              ...(isRencana
                ? {
                    backgroundColor: theme.panel,
                    borderLeftWidth: u(16),
                    borderLeftStyle: "solid",
                    borderLeftColor: accent.accent,
                  }
                : {
                    borderWidth: u(5),
                    borderStyle: "dashed",
                    borderColor: accent.accent,
                  }),
            }}
          >
            <TimeIcon isRencana={isRencana} color={accent.accent} size={u(84)} />
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: u(6) }}>
              <div
                style={{
                  display: "flex",
                  fontSize: u(30),
                  fontWeight: 700,
                  letterSpacing: u(3),
                  textTransform: "uppercase",
                  color: theme.muted,
                }}
              >
                {isRencana ? "Tanggal" : "Waktu"}
              </div>
              <div style={{ fontWeight: 800, lineHeight: 1.1, ...timeStyle }}>
                {time}
              </div>
            </div>
          </div>

          {snapshot.buddies_wanted !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: u(20) }}>
              <PersonIcon color={accent.accent} size={u(52)} />
              <div style={{ display: "flex", fontSize: u(46), fontWeight: 700 }}>
                {`Cari ${snapshot.buddies_wanted} teman`}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: u(16) }}>
            {tags.map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  fontSize: u(34),
                  fontWeight: 700,
                  color: theme.chipFg,
                  backgroundColor: theme.chipBg,
                  borderWidth: u(3),
                  borderStyle: "solid",
                  borderColor: theme.chipBorder,
                  borderRadius: 9999,
                  paddingTop: u(12),
                  paddingBottom: u(12),
                  paddingLeft: u(28),
                  paddingRight: u(28),
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Bawah: QR + URL */}
        <div style={{ display: "flex", alignItems: "center", gap: u(40) }}>
          <div
            style={{
              display: "flex",
              backgroundColor: "#FFFFFF",
              borderRadius: u(16),
              overflow: "hidden",
            }}
          >
            <img src={qr.dataUrl} width={qrPx} height={qrPx} alt="" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: u(14) }}>
            <div style={{ display: "flex", fontSize: u(36), fontWeight: 700 }}>
              Scan untuk lihat detail
            </div>
            <div
              style={{
                fontWeight: 500,
                lineHeight: 1.25,
                color: theme.muted,
                ...clamp(tierFor(urlTier, urlText)),
              }}
            >
              {urlText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Penanda jenis + ikon (SVG sederhana; satori tidak merender emoji)
// ---------------------------------------------------------------------------
function TypeBadge({
  isRencana,
  theme,
  u,
}: {
  isRencana: boolean;
  theme: ThemePalette;
  u: (n: number) => number;
}) {
  const accent = isRencana ? theme.rencana : theme.niat;
  const common: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: u(18),
    borderRadius: 9999,
    paddingTop: u(18),
    paddingBottom: u(18),
    paddingLeft: u(34),
    paddingRight: u(40),
    fontSize: u(40),
    fontWeight: 800,
  };
  // Rencana: pil terisi + centang. Niat: pil putus-putus + bintang.
  if (isRencana) {
    return (
      <div style={{ ...common, backgroundColor: accent.accent, color: accent.onAccent }}>
        <svg width={u(44)} height={u(44)} viewBox="0 0 24 24" fill="none">
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke={accent.onAccent} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: "flex" }}>Sudah ada rencana</div>
      </div>
    );
  }
  return (
    <div
      style={{
        ...common,
        color: accent.accent,
        borderWidth: u(5),
        borderStyle: "dashed",
        borderColor: accent.accent,
      }}
    >
      <svg width={u(44)} height={u(44)} viewBox="0 0 24 24">
        <path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill={accent.accent} />
      </svg>
      <div style={{ display: "flex" }}>Cari peminat</div>
    </div>
  );
}

function TimeIcon({ isRencana, color, size }: { isRencana: boolean; color: string; size: number }) {
  // Kalender; "niat" memakai garis putus-putus dan tanpa isian tanggal.
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect
        x="5"
        y="9"
        width="38"
        height="34"
        rx="6"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={isRencana ? undefined : "7 5"}
      />
      <path d="M14 3v10M34 3v10" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <path d="M5 20h38" stroke={color} strokeWidth="4" />
      {isRencana ? (
        <path d="M16 31l5 5 11-11" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M24 26v10M24 40v0.5" stroke={color} strokeWidth="4" strokeLinecap="round" />
      )}
    </svg>
  );
}

function PersonIcon({ color, size }: { color: string; size: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <circle cx="12" cy="7.5" r="4.5" />
      <path d="M3 21c0-4.5 4-7.5 9-7.5s9 3 9 7.5z" />
    </svg>
  );
}
