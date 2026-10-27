# Contoh kartu (hasil render nyata)

Gambar-gambar ini dibuat oleh renderer kartu yang sama dengan yang dipakai aplikasi (`src/lib/card/render-card.tsx`), dengan data tiruan. QR-nya mengarah ke URL contoh dan bukan trip sungguhan. Dibuat ulang dengan:

```bash
CARD_OUT_DIR=./hasil npx vitest run src/lib/card/render-card.test.ts
```

| Berkas | Isi |
| --- | --- |
| `1-rencana-tema-a-4x5.png` | Jenis "Sudah ada rencana", tema hangat, 4:5 (feed), teks pendek |
| `2-niat-tema-b-4x5.png` | Jenis "Cari peminat", tema malam, 4:5 (feed), teks pendek |
| `3-rencana-tema-b-9x16.png` | Jenis "Sudah ada rencana", tema malam, 9:16 (Story) |
| `4-niat-tema-a-9x16.png` | Jenis "Cari peminat", tema hangat, 9:16 (Story) |
| `5-teks-terpanjang-rencana-a-9x16.png` | Judul 80 karakter, tujuan 60 karakter, 3 tag terpanjang, rentang lintas tahun |
| `6-og-niat-tema-b-600x750.png` | Varian kecil untuk pratinjau link (Open Graph), teks terpanjang |

Pada 9:16, semua konten penting berada di antara y=250 dan y=1580 (zona aman dari UI Instagram/TikTok).
