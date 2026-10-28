# Trip Card

Aplikasi web tanpa login untuk orang yang cari teman jalan: isi form singkat, dapat kartu trip untuk dibagikan ke media sosial, dan halaman detail publik dengan tombol Hubungi.

> **Status: Tahap 4 (edit dan hapus tanpa login).** Sudah ada form `/buat` (dua jenis trip, validasi, pratinjau teks dan pratinjau kartu), penyimpanan ke database lewat `POST /api/trips`, kartu trip berupa gambar PNG (`/api/card/{id}`), layar `/sukses` (unduh gambar, salin link, link edit rahasia), halaman publik `/trip/{id}` dengan pratinjau link (Open Graph), tombol Hubungi lewat `/go/{id}`, "Trip saya" (`/trip-saya`), serta edit dan hapus trip lewat link rahasia `/edit/{token}`. Status "Sudah penuh/lewat" dan analytics dibuat di tahap berikutnya.

Dibangun dengan Next.js (App Router, TypeScript, Tailwind), dideploy di Vercel, dengan Supabase sebagai database Postgres.

---

## Panduan untuk Billy (tanpa perlu memasang apa pun di komputer)

> ⚠️ **PERINGATAN KEAMANAN.** `SUPABASE_SERVICE_ROLE_KEY` adalah kunci "master" database. **Jangan dibagikan ke siapa pun, jangan ditempel di chat/WhatsApp, dan jangan pernah dimasukkan ke repo GitHub ini.** Isi hanya di kolom Environment Variables milik Vercel. Kalau sempat bocor, segera buat ulang (rotate) di Supabase.

### A. Buat proyek Supabase

1. Buka <https://supabase.com> lalu masuk (boleh dengan akun GitHub).
2. Klik **New project**. Isi nama (mis. `trip-card`), buat **Database Password** (simpan di password manager), pilih region terdekat (mis. **Southeast Asia (Singapore)**).
3. Klik **Create new project**, lalu tunggu beberapa menit sampai siap.

### B. Jalankan skema database

1. Di dashboard Supabase, buka **SQL Editor** (menu kiri) > **New query**.
2. Buka file [`supabase/schema.sql`](supabase/schema.sql) di GitHub, salin seluruh isinya, tempel ke SQL Editor.
3. Klik **Run**. Hasil yang benar: `Success. No rows returned`.
4. Buka **Table Editor**: tabel `trips` dan `events` harus sudah ada. Di samping namanya akan terlihat penanda RLS aktif.

File ini aman dijalankan ulang kalau diperlukan.

### C. Ambil URL dan service role key

1. Di Supabase buka **Project Settings** (ikon roda gigi) > **API**.
2. Salin **Project URL** (bentuknya `https://xxxx.supabase.co`) → ini nilai `SUPABASE_URL`.
3. Salin kunci **service_role** (klik *Reveal*) → ini nilai `SUPABASE_SERVICE_ROLE_KEY`. Ingat peringatan di atas.
4. Untuk uji keamanan di langkah E, salin juga kunci **anon** (publik) ke catatan sementara.

> Di dashboard terbaru, kunci bisa tampil dengan nama lain (mis. *Secret key* untuk service role dan *Publishable key* untuk anon), di tab **API Keys**. Gunakan yang berfungsi sebagai service role/secret.

### D. Impor repo ke Vercel dan isi Environment Variables

1. Buka <https://vercel.com>, masuk dengan GitHub, klik **Add New… > Project**.
2. Pilih repo **Cari-Teman-Jalan** lalu **Import**. Framework akan terdeteksi sebagai **Next.js** (biarkan pengaturan bawaan).
3. Buka bagian **Environment Variables** dan tambahkan tiga variabel ini:

   | Nama | Isi |
   | --- | --- |
   | `SUPABASE_URL` | Project URL dari langkah C |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key dari langkah C |
   | `IP_HASH_SALT` | string acak panjang (minimal 32 karakter), buat sendiri, mis. dari password manager. Jangan dibagikan. |

   Jangan memberi awalan `NEXT_PUBLIC_` pada ketiganya.

   Tambahkan juga satu variabel publik untuk footer halaman trip (tahap 2):

   | Nama | Isi |
   | --- | --- |
   | `NEXT_PUBLIC_REPORT_CONTACT` | Kontak untuk lapor/minta hapus trip, mis. email `halo@contoh.com`. Jika berisi `@` otomatis jadi tautan email. Jika dikosongkan, footer menampilkan "[kontak belum diatur]". |

   Opsional, hanya bila memakai **domain kustom** (tahap 3):

   | Nama | Isi |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | Alamat situs tanpa garis miring akhir, mis. `https://tripcard.id`. Dipakai untuk QR di kartu, tombol "Salin link", dan gambar pratinjau link. Jika dikosongkan, dipakai alamat yang sedang dibuka (mis. `https://cari-teman-jalan.vercel.app`), yang sudah benar selama kamu belum memakai domain kustom. |

   Variabel berawalan `NEXT_PUBLIC_` **ditanam saat build**, jadi setelah mengisi atau mengubahnya wajib **Redeploy**. Isinya memang publik; jangan isi rahasia.
4. Klik **Deploy**. Setelah selesai, Vercel memberi URL seperti `https://cari-teman-jalan.vercel.app`.

Jika kamu mengubah Environment Variables setelah deploy, lakukan **Redeploy** (Deployments > menu `…` > Redeploy) supaya nilainya terbaca.

### E. Cara mengecek

1. **Halaman awal.** Buka URL Vercel di HP. Harus tampil judul "Trip Card" dan tulisan bahwa aplikasi sedang disiapkan.
2. **Kesehatan.** Buka `URL-VERCEL/api/health`. Hasil yang benar:

   ```json
   { "ok": true, "db": true }
   ```

   Jika `db: false` (status 503), cek kembali ketiga Environment Variables dan pastikan langkah B sudah dijalankan, lalu Redeploy.
3. **Uji bahwa kunci anon tidak bisa membaca tabel `trips`.** Di Supabase buka **SQL Editor** dan jalankan:

   ```sql
   set role anon;
   select * from public.trips limit 1;
   ```

   Hasil yang benar: ditolak (`permission denied for table trips`) atau kosong. Data tidak boleh keluar. Lalu jalankan `reset role;` untuk kembali normal.

   Alternatif dari terminal (ganti dua nilai; hasilnya harus galat atau `[]`):

   ```bash
   curl "https://XXXX.supabase.co/rest/v1/trips?select=*" -H "apikey: KUNCI_ANON" -H "Authorization: Bearer KUNCI_ANON"
   ```

---

## Catatan teknis

- Semua akses database lewat server (route handler/server action) memakai service role key di `src/lib/supabase/server.ts` (`server-only`, tidak pernah ke browser).
- Row Level Security aktif tanpa policy untuk `trips` dan `events`, dan hak akses anon/authenticated dicabut, jadi kunci publik tidak bisa membaca atau menulis apa pun.
- Tidak memakai Supabase Auth. Tabel `events` tidak menyimpan data pribadi.
- Variabel lingkungan ada di `.env.example` (hanya nama). Untuk pengembangan lokal, salin menjadi `.env.local`; file itu diabaikan git.
- Perintah: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`.

### Tahap 1: cara kerja singkat

- Validasi dan normalisasi ada di satu tempat, `src/lib/trip/schema.ts` (zod), dipakai form di browser dan `POST /api/trips`. Server yang menentukan; isian dari browser tidak dipercaya.
- `POST /api/trips` memvalidasi ulang (gagal: `400` dengan pesan per field, database tidak disentuh), lalu menyimpan ke `trips`. Sukses: `201 { id, editToken }`.
- ID trip: 10 karakter base62 acak. Token edit: 32 byte acak, hanya hash SHA-256-nya yang disimpan (`edit_token_hash`); token mentah dikirim ke browser satu kali dan disimpan di localStorage (`tripcard:mytrips`). Token tidak pernah masuk URL atau log.
- `creator_ip_hash` = SHA-256(IP + `IP_HASH_SALT`), `device_id` = UUID acak dari localStorage. Keduanya baru disimpan; belum ada pembatasan (Tahap 6).
- Kontak tersimpan ternormalisasi (WhatsApp `628xx` tanpa plus; Instagram tanpa `@`, huruf kecil) dan tidak ditampilkan di pratinjau.

### Tahap 2: cara kerja singkat

- `/trip/{id}`: halaman publik (server component, dirender dinamis, `noindex`). ID harus 10 karakter base62; ID tidak valid atau trip tidak ada menampilkan "Trip tidak ditemukan" dengan status 404 (ID tidak valid tidak menyentuh database). Tidak ada daftar/pencarian trip; `/trip` tanpa ID adalah 404.
- Query halaman ini memakai daftar kolom eksplisit (`PUBLIC_TRIP_COLUMNS` di `src/lib/trip/public-columns.ts`), tanpa kontak, hash token, hash IP, device id, maupun snapshot kartu.
- Tombol "Tertarik / Hubungi" adalah tautan ke `/go/{id}`. Route itu membaca kontak di server dan membalas redirect 302 ke `https://wa.me/{nomor}` atau `https://instagram.com/{username}` (header `Cache-Control: no-store`, `X-Robots-Tag: noindex`). Nomor/akun tidak ada di HTML halaman trip.
- `public/robots.txt` melarang `/go/` dan `/trip/`.

Cek setelah deploy (ganti `URL` dan `ID`):

```bash
# harus 302 dengan header Location ke wa.me / instagram.com
curl -i https://URL/go/ID
# nomor kontak tidak boleh ada di HTML; ganti pola dengan nomor/akun yang kamu isi (hasil harus 0)
curl -s https://URL/trip/ID | grep -c "62812"
# ID ngawur: harus 404
curl -i https://URL/trip/ngawur1234
```

### Tahap 3: cara kerja singkat

- **Kartu = gambar PNG yang dibuat di server** dengan `ImageResponse` (`next/og`, runtime Node.js). Satu fungsi murni, `renderCard(snapshot, { ratio, size, url })` di `src/lib/card/render-card.tsx`, dipakai oleh semua jalur: pratinjau form, layar sukses, dan Open Graph. Tidak membaca database, jadi bisa diuji dengan data tiruan.
- **Kartu adalah snapshot.** Digambar dari kolom `trips.card_snapshot` (bukan data trip terbaru), jadi kartu tidak berubah walau trip diedit nanti. Snapshot tidak memuat nama pembuat, kontak, budget, itinerary, maupun catatan.
- Ukuran: `r=9x16` 1080x1920 (Story/Reels/TikTok), `r=4x5` 1080x1350 (feed), `size=og` 600x750 untuk pratinjau link (semua dimensi layout memakai satu faktor skala). Pada 9:16, konten penting dijauhkan dari 250px teratas dan 340px terbawah (area UI Instagram/TikTok).
- Dua jenis tampil berbeda ("Sudah ada rencana": pil terisi, panel tanggal terisi, bingkai garis penuh; "Cari peminat": pil dan panel berkontur, bingkai putus-putus) dan dua tema warna: `a` hangat, `b` malam. Pilihan tema tersimpan di `trips.theme` dan `card_snapshot.theme`.
- **Endpoint:**
  - `GET /api/card/{id}?r=9x16|4x5&size=og&download=1`: id harus 10 karakter base62 (id salah = 404 tanpa menyentuh database), `r` salah atau `size` selain `og` = 400. Hanya membaca kolom `card_snapshot`. `download=1` menambah `Content-Disposition: attachment`. Cache: `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`.
  - `POST /api/card/preview?r=...`: menerima data form (JSON), memvalidasi dengan skema yang sama, lalu mengembalikan PNG dari renderer yang sama. Tidak menyimpan apa pun; QR mengarah ke URL contoh. Body maks 20.000 karakter; validasi gagal = 400.
- **Font:** Plus Jakarta Sans (Medium, Bold, ExtraBold; statis, aksara Latin) di `src/assets/fonts/`, lisensi SIL Open Font License 1.1 (`OFL.txt` di folder yang sama). Dimuat dari berkas lokal, tidak ada unduhan font saat runtime. Emoji pada judul/tujuan dibuang dari gambar kartu (font tidak memuat emoji, dan satori akan mengunduh gambar emoji dari internet bila ada).
- **QR** dibuat di server dengan pustaka `qrcode`: hitam di atas putih dengan zona tenang 4 modul, di tema mana pun.
- **URL situs** untuk QR dan tautan salin: `NEXT_PUBLIC_SITE_URL` bila diisi, kalau tidak origin permintaan (lihat tabel Environment Variables). Isi variabel ini bila memakai domain kustom.
- **Open Graph** di `/trip/{id}`: `og:title`, `og:description` (tujuan + waktu), `og:image` = `/api/card/{id}?r=4x5&size=og` (600x750), Twitter card `summary_large_image`. Halaman tetap `noindex`. `public/robots.txt` tidak melarang `/api/card/`; crawler pratinjau (WhatsApp, Meta, Twitter) juga diizinkan membaca `/trip/` (pengunjung lain tetap dilarang), sedangkan `/go/` tetap dilarang untuk semua.
- Contoh hasil render ada di [`docs/contoh-kartu/`](docs/contoh-kartu/). Untuk menyimpan semua kombinasi saat menjalankan uji: `CARD_OUT_DIR=./hasil npx vitest run src/lib/card/render-card.test.ts`.

Cek setelah deploy (ganti `URL` dan `ID`):

```bash
# harus 200, image/png, dan header cache-control seperti di atas
curl -sI "https://URL/api/card/ID?r=4x5&size=og"
# harus ada Content-Disposition: attachment
curl -sI "https://URL/api/card/ID?r=9x16&download=1"
# ID ngawur: 404; r ngawur: 400
curl -i https://URL/api/card/ngawur
curl -i "https://URL/api/card/ID?r=1x1"
# tag Open Graph di halaman trip
curl -s https://URL/trip/ID | grep -o '<meta[^>]*og:[^>]*>'
```

Pratinjau link WhatsApp/Instagram di-cache oleh aplikasinya. Gunakan trip baru saat mengecek; untuk memaksa muat ulang di Facebook/Instagram bisa memakai Sharing Debugger Meta.

### Tahap 4: cara kerja singkat

**Langkah wajib untuk Billy: jalankan migrasi SQL satu kali.** Buka Supabase > **SQL Editor** > **New query**, salin seluruh isi [`supabase/migrations/001_trips_edit_token_hash_unique.sql`](supabase/migrations/001_trips_edit_token_hash_unique.sql), tempel, klik **Run**. Hasil yang benar: `Success. No rows returned`. Isinya satu pernyataan: `create unique index if not exists trips_edit_token_hash_key on public.trips (edit_token_hash);` (aman dijalankan ulang; proyek baru yang menjalankan `schema.sql` terbaru sudah memilikinya).

- **Link edit** `{situs}/edit/{token}` (token 43 karakter). Server menghitung SHA-256 token lalu mencocokkan `edit_token_hash`; token mentah tidak disimpan, tidak masuk log, dan tidak ada di halaman publik. Halaman edit dan responsnya: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` (di `next.config.ts`), meta `noindex`, dan `/edit/` dilarang di `public/robots.txt`.
- **`/sukses`** menampilkan link edit dengan tombol "Salin link edit". Token dibaca dari localStorage `tripcard:mytrips` (bukan dari URL), dengan cadangan di `sessionStorage` (`tripcard:lastcreated`). Bila keduanya gagal, tampil peringatan dan footer kontak untuk minta penghapusan.
- **`/trip-saya`**: daftar dari localStorage saja (tanpa panggilan server); ada tautannya di halaman awal. Entri yang trip-nya sudah dihapus (halaman edit 404) bisa dibuang lewat "Hapus dari daftar di perangkat ini".
- **Edit** (`/edit/[token]`): memakai skema dan kolom isian yang sama dengan `/buat` (`validateTripEdit` di `src/lib/trip/schema.ts`, `TripFields` di `src/components/trip-fields.tsx`). Jenis trip tidak bisa diubah. Tanggal berangkat/bulan awal (dan pulang/akhir) hanya dicek "tidak di masa lalu" bila nilainya berubah. `POST /api/trips/edit` (token di body) hanya meng-UPDATE kolom di `EDITABLE_COLUMNS` (`src/lib/trip/edit-columns.ts`); `card_snapshot`, `theme`, `is_full`, hash, dan `device_id` tidak pernah disentuh, jadi kartu tidak ikut berubah.
- **Hapus**: `POST /api/trips/delete` (token di body) menghapus permanen baris `trips`; baris `events` tidak disentuh. Setelah itu `/trip/{id}`, `/go/{id}`, dan `/api/card/{id}` memberi 404. Gambar kartu di cache CDN (`s-maxage=3600`) bisa masih tampil hingga sekitar satu jam; strategi cache tidak diubah.

### Menguji validasi server dengan curl

Ganti `URL-VERCEL`. Hasil yang benar: status `400` dan pesan error per field (tujuan terlalu panjang, tanggal pulang sebelum berangkat); database tidak disentuh.

```bash
curl -i -X POST https://URL-VERCEL/api/trips \
  -H "Content-Type: application/json" \
  -d '{"type":"rencana","destination":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","creatorName":"Billy","tags":["foodie"],"contactType":"whatsapp","contactValue":"081234567890","startDate":"2099-01-05","endDate":"2099-01-01","deviceId":"3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b"}'
```
