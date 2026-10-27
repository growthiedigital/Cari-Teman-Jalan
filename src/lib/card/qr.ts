import QRCode from "qrcode";

/** Modul QR per sisi, ditambah zona tenang (quiet zone) 4 modul di setiap sisi. */
const QUIET_ZONE_MODULES = 4;

export type QrImage = {
  /** Data URL SVG: hitam di atas putih, termasuk zona tenang. */
  dataUrl: string;
  /** Jumlah modul per sisi termasuk zona tenang. */
  modules: number;
};

/**
 * QR dari teks (URL). Selalu hitam di atas putih dengan zona tenang penuh
 * supaya terbaca kamera di tema apa pun. Digambar sebagai satu path SVG
 * dengan `crispEdges`; ukuran piksel akhir sebaiknya kelipatan bulat dari
 * `modules` agar tepi modul tajam.
 */
export function createQrImage(text: string): QrImage {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const total = size + QUIET_ZONE_MODULES * 2;

  let path = "";
  for (let row = 0; row < size; row++) {
    let col = 0;
    while (col < size) {
      if (!qr.modules.get(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < size && qr.modules.get(row, col)) col++;
      path += `M${start + QUIET_ZONE_MODULES} ${row + QUIET_ZONE_MODULES}h${col - start}v1h-${col - start}z`;
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#FFFFFF"/>` +
    `<path d="${path}" fill="#000000"/></svg>`;
  return {
    dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    modules: total,
  };
}
