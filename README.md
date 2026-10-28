# Trip Card

Aplikasi web tanpa login untuk orang yang cari teman jalan: isi form singkat, dapat kartu trip untuk dibagikan ke media sosial, dan halaman detail publik dengan tombol Hubungi.

> **Status: v1 selesai, audit akhir (Tahap 7) sudah dilakukan.** Hasil audit, daftar route, dan temuan ada di [`docs/audit-v1.md`](docs/audit-v1.md). Riwayat cara kerja per tahap ada di bagian "Catatan teknis" di bawah.

Dibangun dengan Next.js (App Router, TypeScript, Tailwind), dideploy di Vercel, dengan Supabase sebagai database Postgres.

---

## Panduan untuk Billy (tanpa perlu memasang apa pun di komputer)

> ⚠️ **PERINGATAN KEAMANAN.** `SUPABASE_SERVICE_ROLE_KEY` adalah kunci "master" database. **Jangan dibagikan ke siapa pun, jangan ditempel di chat/WhatsApp, dan jangan pernah dimasukkan ke repo GitHub ini.** Isi hanya di kolom Environment Variables milik Vercel. Kalau sempat bocor, segera buat ulang (rotate) di Supabase.

### A. Buat proyek Supabase

1. Buka <https://supabase.com> lalu masuk (boleh dengan akun GitHub).
2. Klik **New project**. Isi nama (mis. `trip-card`), buat **Database Password** (simpan di password manager), pilih region terdekat (mis. **Southeast Asia (Singapore)**).
3. Klik **Create new project**, lalu tunggu beberapa menit sampai siap.

### B. Jalankan skema database

Urutannya penting: **`schema.sql` dulu, baru semua file di `supabase/migrations/` berurutan menurut nomornya.**

1. Di dashboard Supabase, buka **SQL Editor** (menu kiri) > **New query**.
2. Buka file [`supabase/schema.sql`](supabase/schema.sql) di GitHub, salin seluruh isinya, tempel ke SQL Editor, klik **Run**. Hasil yang benar: `Success. No rows returned`.
3. Buka **New query** lagi, lalu jalankan satu per satu (urut nomor) setiap file di folder [`supabase/migrations/`](supabase/migrations/). Saat ini hanya ada satu: [`001_trips_edit_token_hash_unique.sql`](supabase/migrations/001_trips_edit_token_hash_unique.sql) (indeks unik untuk link edit). Hasil yang benar: `Success. No rows returned`.
   - Proyek **baru**: `schema.sql` terbaru sudah memuat isi migrasi itu, jadi menjalankannya tidak mengubah apa-apa. Tetap jalankan supaya urutannya selalu lengkap.
   - Proyek **lama** (dibuat sebelum Tahap 4): migrasi 001 wajib dijalankan.
   - Kalau kelak ada migrasi baru (nomor lebih besar), jalankan juga, berurutan.
4. Buka **Table Editor**: tabel `trips` dan `events` harus sudah ada. Di samping namanya akan terlihat penanda RLS aktif.

Semua file ini aman dijalankan ulang.

### C. Ambil URL dan service role key

1. Di Supabase buka **Project Settings** (ikon roda gigi) > **API**.
2. Salin **Project URL** (bentuknya `https://xxxx.supabase.co`) → ini nilai `SUPABASE_URL`.
3. Salin kunci **service_role** (klik *Reveal*) → ini nilai `SUPABASE_SERVICE_ROLE_KEY`. Ingat peringatan di atas.
4. Untuk uji keamanan di langkah E, salin juga kunci **anon** (publik) ke catatan sementara.

> Di dashboard terbaru, kunci bisa tampil dengan nama lain (mis. *Secret key* untuk service role dan *Publishable key* untuk anon), di tab **API Keys**. Gunakan yang berfungsi sebagai service role/secret.

### D. Impor repo ke Vercel dan isi Environment Variables

1. Buka <https://vercel.com>, masuk dengan GitHub, klik **Add New… > Project**.
2. Pilih repo **Cari-Teman-Jalan** lalu **Import**. Framework akan terdeteksi sebagai **Next.js** (biarkan pengaturan bawaan).
3. Buka bagian **Environment Variables** dan tambahkan semua variabel di bawah ini. Daftar ini lengkap: tidak ada variabel lain yang dibaca aplikasi.

   | Nama | Wajib? | Fungsi | Isi |
   | --- | --- | --- | --- |
   | `SUPABASE_URL` | Wajib | Alamat proyek Supabase untuk koneksi dari server. | Project URL dari langkah C |
   | `SUPABASE_SERVICE_ROLE_KEY` | Wajib, **rahasia** | Kunci server untuk membaca/menulis database. Hanya dipakai di server. | service role key dari langkah C |
   | `IP_HASH_SALT` | Wajib, **rahasia** | "Garam" untuk menyamarkan IP pembuat trip (disimpan sebagai hash, bukan IP asli) yang dipakai batas 5 trip per 24 jam. Kalau nilainya diganti, hitungan batas yang lama tidak cocok lagi (batas ter-reset); tidak ada akibat lain. | String acak panjang, minimal 32 karakter, buat sendiri (mis. dari password manager) |
   | `NEXT_PUBLIC_REPORT_CONTACT` | Sangat dianjurkan | Kontak untuk lapor atau minta hapus trip; tampil di footer halaman trip dan layar sukses. Jika berisi email, otomatis jadi tautan `mailto:`. Jika **dikosongkan**, semua pengunjung melihat tulisan `[kontak belum diatur]`. | mis. `halo@contoh.com` |
   | `NEXT_PUBLIC_SITE_URL` | Opsional | Alamat situs untuk QR di kartu, tombol "Salin link", dan gambar pratinjau link. Isi **hanya** bila memakai domain kustom. Jika dikosongkan, dipakai alamat yang sedang dibuka (mis. `https://cari-teman-jalan.vercel.app`), yang sudah benar selama belum ada domain kustom. | Alamat tanpa garis miring akhir, mis. `https://tripcard.id` |

   - Jangan memberi awalan `NEXT_PUBLIC_` pada `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, atau `IP_HASH_SALT`: variabel berawalan itu ikut terkirim ke browser.
   - Variabel `NEXT_PUBLIC_*` **ditanam saat build**, jadi setelah mengisi atau mengubahnya wajib **Redeploy**. Isinya memang publik; jangan isi rahasia.
4. Klik **Deploy**. Setelah selesai, Vercel memberi URL seperti `https://cari-teman-jalan.vercel.app`.

Jika kamu mengubah Environment Variables apa pun setelah deploy, lakukan **Redeploy** (Deployments > menu `…` > Redeploy) supaya nilainya terbaca.

### E. Cara mengecek

1. **Halaman awal.** Buka URL Vercel di HP. Harus tampil judul "Trip Card", kalimat singkat tentang kartu trip, serta tombol "Buat trip" dan "Trip saya".
2. **Kesehatan.** Buka `URL-VERCEL/api/health`. Hasil yang benar:

   ```json
   { "ok": true, "db": true }
   ```

   Jika `db: false` (status 503), cek kembali `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` dan pastikan langkah B sudah dijalankan, lalu Redeploy. Perhatian: pemeriksaan ini **tidak** mengecek `IP_HASH_SALT`; kalau variabel itu kosong, `/api/health` tetap hijau tetapi menyimpan trip gagal dengan pesan "Terjadi kesalahan di server". Uji juga dengan membuat satu trip sungguhan.
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

### F. Menghapus trip secara manual (kalau ada laporan)

Pembuat bisa menghapus tripnya sendiri lewat link edit. Kalau ada orang melapor lewat kontak di footer (atau pembuatnya kehilangan link edit), hapus lewat dashboard Supabase:

1. Minta link trip yang dilaporkan, bentuknya `https://URL-VERCEL/trip/ID`. **ID** adalah 10 karakter setelah `/trip/`.
2. Di Supabase buka **SQL Editor** > **New query**, lalu jalankan (ganti `ID_TRIP`). Kueri pertama untuk memastikan itu trip yang benar (kontak sengaja tidak ditampilkan):

   ```sql
   select id, title, destination, creator_name, created_at
   from public.trips where id = 'ID_TRIP';
   ```

   ```sql
   delete from public.trips where id = 'ID_TRIP' returning id;
   ```

   Hasil yang benar: satu baris berisi ID itu. Tanpa baris = ID salah atau trip sudah terhapus.
3. Alternatif tanpa SQL: **Table Editor** > tabel `trips` > cari baris (filter kolom `id`) > centang barisnya > **Delete row**.
4. Akibatnya: `/trip/ID`, `/go/ID`, dan `/api/card/ID` langsung menjadi "tidak ditemukan". Dua hal di luar kendali aplikasi: (a) gambar kartu yang sudah tersimpan di CDN Vercel bisa masih tampil sekitar satu jam; (b) pratinjau link yang sudah dibuat WhatsApp/Instagram di chat orang lain tetap ada di aplikasi mereka. Kartu hanya memuat judul, tujuan, tanggal/bulan, dan tag (tanpa nama dan kontak).
5. Tabel `events` tidak berisi data pribadi sehingga tidak perlu dibersihkan. Bila mau: `delete from public.events where trip_id = 'ID_TRIP';`.

Pembuat yang kehilangan link edit tidak bisa memulihkannya (aplikasi hanya menyimpan hash-nya). Hapus trip lamanya dengan langkah di atas, lalu minta pembuat membuat trip baru.

### G. Menguji status "Sudah lewat"

Trip jenis "Sudah ada rencana" otomatis berstatus "Sudah lewat" mulai 00:00 WIB hari setelah tanggal pulang. Untuk melihatnya tanpa menunggu, ubah tanggal langsung di Supabase > SQL Editor pada trip uji jenis rencana (ganti `ID_TRIP_UJI`), lalu muat ulang `/trip/ID_TRIP_UJI`. Yang harus terlihat: penanda "Sudah lewat" dan tombol Hubungi nonaktif ("Trip ini sudah lewat"); `/go/ID_TRIP_UJI` mengalihkan kembali ke halaman trip, bukan ke WhatsApp/Instagram. Di halaman edit, tanggal berangkat/pulang yang lama tetap boleh disimpan, tetapi tanggal baru di masa lalu ditolak.

```sql
-- catat dulu tanggal aslinya
select id, start_date, end_date from public.trips where id = 'ID_TRIP_UJI';

-- jadikan sudah lewat (berangkat 2 hari lalu, pulang kemarin, tanggal Jakarta)
update public.trips
set start_date = (now() at time zone 'Asia/Jakarta')::date - 2,
    end_date   = (now() at time zone 'Asia/Jakarta')::date - 1
where id = 'ID_TRIP_UJI' and type = 'rencana';

-- kembalikan: isi dengan tanggal asli yang dicatat tadi
update public.trips
set start_date = 'YYYY-MM-DD', end_date = 'YYYY-MM-DD'
where id = 'ID_TRIP_UJI';
```

Tombol "Tandai sudah penuh" ada di halaman edit (`/edit/{token}`), bagian "Status trip".

### H. Membaca hasil analytics (metrik sukses)

Buka Supabase > **SQL Editor** > **New query**, salin isi [`supabase/queries/metrik-sukses.sql`](supabase/queries/metrik-sukses.sql), lalu tempel **satu kueri** (dari tanda `-- KUERI n` sampai titik koma) dan klik **Run**. Kalau seluruh file dijalankan sekaligus, hanya hasil kueri terakhir (Kueri 5: ringkasan tiga metrik) yang tampil.

1. **Funnel per jenis trip dan per hari** (zona Asia/Jakarta): jumlah tiap event.
2. **% menyelesaikan form** = `trip_created` ÷ `form_opened`, per jenis dan total.
3. **% kartu diunduh atau linknya disalin** = trip unik dengan `card_downloaded` atau `link_copied` ÷ trip yang tercatat `trip_created`.
4. **Trip yang menerima klik Hubungi** = jumlah trip unik dengan `contact_clicked`, plus % terhadap `trip_created`.

Cara membaca dengan benar:

- Angkanya **berbasis event, bukan pengunjung unik**: aplikasi sengaja tidak menyimpan data pribadi, jadi satu orang yang membuka form dua kali dihitung dua kali.
- Klik **Hubungi** yang kamu lakukan sendiri saat menguji trip milikmu **ikut terhitung** (halaman detail milikmu tidak dihitung sebagai `detail_viewed`, tetapi `/go/{id}` tidak bisa membedakan siapa yang mengklik). Untuk membersihkan data uji: `delete from public.events where trip_id = 'ID_TRIP_UJI';`.
- Persentase kartu dan Hubungi hanya menghitung trip yang punya event `trip_created`; trip yang dibuat sebelum Tahap 6 tidak ikut.
- Unduhan yang dicatat adalah permintaan `?download=1` yang berhasil memulai pengiriman gambar; belum tentu file tersimpan di perangkat.

Arti kolom hasilnya:

| Kueri | Kolom penting | Artinya |
| --- | --- | --- |
| 1 (funnel) | `form_opened`, `trip_created`, `card_downloaded`, `link_copied`, `detail_viewed`, `contact_clicked` | Jumlah tiap event per hari dan jenis trip. |
| 2 | `persen_selesai_form` | `trip_created` ÷ `form_opened`. Mis. form dibuka 40 kali dan 12 trip dibuat = 30%. Baris `TOTAL` = semua jenis. |
| 3 | `persen_diunduh_atau_disalin` | Dari semua trip yang dibuat, berapa persen yang kartunya diunduh atau linknya disalin (per trip, bukan per klik). |
| 4 | `persen_dengan_klik_hubungi` | Dari semua trip yang dibuat, berapa persen yang pernah menerima klik Hubungi. |
| 5 (ringkasan, satu baris) | `1_persen_selesai_form`, `2_persen_diunduh_atau_disalin`, `3_persen_dengan_klik_hubungi` | Tiga metrik sukses sekaligus; sama dengan baris `TOTAL` kueri 2, 3, dan 4. |

## Batasan v1 yang diketahui

Ini sengaja diterima di v1 (rinciannya ada di [`docs/audit-v1.md`](docs/audit-v1.md)):

- **Link edit hilang = tidak bisa mengedit.** Tidak ada akun dan tidak ada pemulihan; hapus manual lewat bagian F.
- **"Trip saya" hanya ada di browser** yang dipakai membuat trip; hilang bila data browser dibersihkan atau ganti perangkat.
- **Link edit memuat token rahasia di alamatnya.** Token tidak pernah dicatat oleh kode aplikasi, tetapi alamat lengkap bisa muncul di riwayat browser dan, kemungkinan besar, di log permintaan Vercel (log itu hanya bisa dibuka anggota proyek Vercel; belum diperiksa di dashboard Vercel sungguhan).
- **Kartu adalah snapshot**: edit trip tidak mengubah kartu yang sudah diunduh/dibagikan, juga pratinjau gambar saat link dibagikan.
- **Trip tidak dihapus otomatis.** Trip yang sudah lewat tetap ada (dengan penanda "Sudah lewat" dan tombol Hubungi nonaktif).
- **Batas 5 trip per 24 jam bisa dilewati** dengan menghapus data browser (batas per perangkat), tidak berlaku akurat untuk permintaan serentak, dan satu IP seluler bersama bisa terkena batas bersama (lihat "Tahap 6").
- **Tidak ada pembatasan laju** pada pratinjau kartu, gambar kartu, dan pencatatan event; angka analytics bisa digelembungkan oleh pihak yang sengaja.
- **Analytics berbasis event, bukan pengunjung unik** (lihat bagian H).
- **Pratinjau link** hanya diizinkan untuk crawler WhatsApp, Instagram/Facebook (Meta), dan Twitter/X. Aplikasi lain (mis. Telegram, Slack, Discord) mungkin tidak menampilkan pratinjau karena `/trip/` dilarang di `robots.txt`.
- **Tidak ada tombol Laporkan.** Pelaporan lewat kontak di footer (`NEXT_PUBLIC_REPORT_CONTACT`), penanganannya manual (bagian F).

Sengaja belum dibuat: feed publik/penelusuran trip, profil/login, moderasi otomatis, swipe/skor kecocokan, verifikasi/rating, chat dalam aplikasi, AI itinerary, notifikasi/ikuti trip, editor kartu bebas, dan autocomplete tujuan.

---

## Catatan teknis

- Semua akses database lewat server (route handler/server action) memakai service role key di `src/lib/supabase/server.ts` (`server-only`, tidak pernah ke browser).
- Row Level Security aktif tanpa policy untuk `trips` dan `events`, dan hak akses anon/authenticated dicabut, jadi kunci publik tidak bisa membaca atau menulis apa pun.
- Tidak memakai Supabase Auth. Tabel `events` tidak menyimpan data pribadi.
- Variabel lingkungan ada di `.env.example` (hanya nama). Untuk pengembangan lokal, salin menjadi `.env.local`; file itu diabaikan git.
- Perintah: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck` (menjalankan `next typegen` dulu, jadi aman di checkout baru), `npm test`.
- Halaman 404 dan halaman galat server berbahasa Indonesia (`src/app/not-found.tsx`, `src/app/error.tsx`); halaman 404 khusus ada untuk `/trip/{id}` dan `/edit/{token}`.

### Tahap 1: cara kerja singkat

- Validasi dan normalisasi ada di satu tempat, `src/lib/trip/schema.ts` (zod), dipakai form di browser dan `POST /api/trips`. Server yang menentukan; isian dari browser tidak dipercaya.
- `POST /api/trips` memvalidasi ulang (gagal: `400` dengan pesan per field, database tidak disentuh), lalu menyimpan ke `trips`. Sukses: `201 { id, editToken }`.
- ID trip: 10 karakter base62 acak. Token edit: 32 byte acak, hanya hash SHA-256-nya yang disimpan (`edit_token_hash`); token mentah dikirim ke browser satu kali dan disimpan di localStorage (`tripcard:mytrips`). Token juga menjadi bagian alamat link edit `/edit/{token}` (lihat Tahap 4); kode aplikasi tidak pernah mencatatnya di log.
- `creator_ip_hash` = SHA-256(IP + `IP_HASH_SALT`), `device_id` = UUID acak dari localStorage. Keduanya dipakai untuk batas 5 trip per 24 jam sejak Tahap 6.
- Kontak tersimpan ternormalisasi (WhatsApp `628xx` tanpa plus; Instagram tanpa `@`, huruf kecil) dan tidak ditampilkan di pratinjau.

### Tahap 2: cara kerja singkat

- `/trip/{id}`: halaman publik (server component, dirender dinamis, `noindex`). ID harus 10 karakter base62; ID tidak valid atau trip tidak ada menampilkan "Trip tidak ditemukan" dengan status 404 (ID tidak valid tidak menyentuh database). Tidak ada daftar/pencarian trip; `/trip` tanpa ID adalah 404.
- Query halaman ini memakai daftar kolom eksplisit (`PUBLIC_TRIP_COLUMNS` di `src/lib/trip/public-columns.ts`), tanpa kontak, hash token, hash IP, device id, maupun snapshot kartu.
- Tombol "Tertarik / Hubungi" adalah tautan ke `/go/{id}`. Route itu membaca kontak di server dan membalas redirect 302 ke `https://wa.me/{nomor}` atau `https://instagram.com/{username}` (header `Cache-Control: no-store`, `X-Robots-Tag: noindex`). Nomor/akun tidak ada di HTML halaman trip.
- `public/robots.txt` melarang `/go/`, `/trip/`, dan `/edit/` (kecuali `/trip/` untuk crawler pratinjau link; lihat Tahap 3).

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

### Tahap 5: cara kerja singkat

Tidak ada migrasi: kolom `trips.is_full` sudah ada di `schema.sql` sejak Tahap 0.

- **Aturan status ada di satu tempat:** `src/lib/trip/status.ts`. `isExpired(trip, now)` benar hanya untuk jenis `rencana` yang `end_date`-nya lebih kecil dari tanggal HARI INI menurut Asia/Jakarta (dibandingkan sebagai teks `YYYY-MM-DD`; pada tanggal pulang itu sendiri belum lewat, baru lewat mulai 00:00 WIB hari berikutnya). Jenis `niat` tidak pernah "Sudah lewat". `tripStatus(trip, now)` mengembalikan `{ isFull, isExpired, canContact }` dengan `canContact = !isFull && !isExpired`; dipakai halaman detail, `/go/{id}`, dan halaman edit. Dihitung saat halaman dirender: tanpa cron, tanpa kolom baru.
- **Halaman detail `/trip/{id}`:** penanda "Sudah lewat" dan/atau "Sudah penuh" di atas jenis trip. Bila `canContact` salah, tombol Hubungi diganti tombol nonaktif (bukan tautan, tanpa `href` ke `/go`) berlabel "Trip ini sudah lewat" atau "Trip ini sudah penuh"; info trip dan footer tetap tampil. Judul, deskripsi, dan Open Graph tidak berubah, begitu juga gambar kartu (snapshot, tanpa status).
- **`/go/{id}` menegakkan status di server:** trip penuh/lewat dibalas 302 ke `/trip/{id}` (bukan ke WhatsApp/Instagram). Id tidak valid atau trip tidak ada tetap 404.
- **Tandai penuh:** bagian "Status trip" di `/edit/{token}` memanggil `POST /api/trips/status` dengan `{ token, isFull }` (token di body). Endpoint hanya meng-UPDATE kolom `is_full`; `POST /api/trips/edit` tetap tidak menyentuhnya. Token tidak dikenal = 404 generik, `isFull` bukan boolean = 400.

Cek setelah deploy (ganti `URL` dan `ID`; trip harus sudah ditandai penuh lebih dulu):

```bash
# trip penuh/lewat: harus 302 dengan Location: /trip/ID (bukan wa.me / instagram.com)
curl -i https://URL/go/ID
# halaman detail trip penuh: tidak boleh ada tautan /go/
curl -s https://URL/trip/ID | grep -c 'href="/go/'
```

Cara menguji tampilan "Sudah lewat" lewat SQL ada di bagian **G** di atas.

### Tahap 6: cara kerja singkat

Tidak ada migrasi: tabel `events` dan indeks `(creator_ip_hash, created_at)` serta `(device_id, created_at)` sudah ada sejak Tahap 0.

**Batas pembuatan trip.** `MAX_TRIPS_PER_WINDOW = 5` dalam jendela 24 jam bergulir (`src/lib/trip/rate-limit.ts`). Di `POST /api/trips`, setelah validasi lolos dan sebelum insert, server menghitung baris `trips` dalam 24 jam terakhir dengan `creator_ip_hash` yang sama ATAU `device_id` yang sama; bila salah satu >= 5, balasannya `429` + header `Retry-After` (detik sampai satu slot kosong) + pesan umum "Kamu sudah membuat 5 trip dalam 24 jam terakhir. Coba lagi nanti." Form menampilkannya di atas tombol Kirim dan semua isian tetap ada. Bila IP klien tidak bisa ditentukan, hanya `device_id` yang dihitung. Edit, hapus, status, dan pratinjau kartu tidak dibatasi.

Batasan yang diterima di v1 (sengaja belum diperbaiki):

- Menghapus trip membebaskan satu slot, karena hitungan berdasar baris `trips` yang ada.
- Permintaan serentak bisa sedikit melewati batas (hitung lalu insert tidak atomik).
- Pengguna di jaringan seluler yang berbagi satu IP bisa terkena batas bersama lewat IP.
- Siapa pun bisa mengganti `device_id` (hapus data browser) untuk lolos dari batas per perangkat; yang tetap menahan hanya batas per IP.

**Analytics tanpa data pribadi.** Tabel `events` hanya berisi `event`, `trip_type`, `trip_id`, dan waktu. Tidak ada IP, user agent, referrer, `device_id`, cookie, atau token.

| Event | Dicatat di | Kapan |
| --- | --- | --- |
| `form_opened` | klien `/buat` → `POST /api/events` | pengguna memilih jenis trip; sekali per pemuatan halaman |
| `trip_created` | server, `POST /api/trips` | hanya setelah insert berhasil |
| `card_downloaded` | server, `GET /api/card/{id}?download=1` | gambar berhasil dibuat; varian ini `Cache-Control: no-store` |
| `link_copied` | klien `/sukses` → `POST /api/events` | "Salin link" (halaman detail) berhasil; "Salin link edit" tidak |
| `detail_viewed` | klien `/trip/{id}` → `POST /api/events` | sekali per pemuatan; tidak dicatat bila trip ada di "Trip saya" browser itu |
| `contact_clicked` | server, `/go/{id}` | hanya saat benar-benar redirect ke WhatsApp/Instagram; bukan HEAD, bukan prefetch |

- `recordEvent` (`src/lib/analytics/record-event.ts`) tidak pernah melempar error; di server dijalankan lewat `after()` (Next.js >= 15) sehingga tidak menunda respons.
- `POST /api/events` hanya menerima `form_opened`, `detail_viewed`, `link_copied`. Untuk event dengan `tripId`, `trip_type` diturunkan dari tabel `trips` (nilai dari klien diabaikan); trip tidak ada = tidak dicatat. Balasan 204 tanpa body (juga untuk bot/diabaikan), 400 untuk body atau event tidak valid (termasuk body > 500 karakter).
- `isBot(userAgent)` (`src/lib/analytics/is-bot.ts`) menyaring crawler, `curl`, dsb. dan UA kosong; browser dalam aplikasi Instagram/TikTok/Facebook tidak disaring. Crawler pratinjau link tidak menjalankan JavaScript, jadi `detail_viewed` (dari klien) memang tidak menghitungnya.

Cara membaca hasil analytics (metrik sukses) ada di bagian **H** di atas.

Cek setelah deploy (ganti `URL` dan `ID`):

```bash
# unduhan: harus Cache-Control: no-store (varian lain tetap memakai cache Tahap 3)
curl -sI "https://URL/api/card/ID?r=9x16&download=1" | grep -i cache-control
# event server-only ditolak: harus 400
curl -i -X POST https://URL/api/events -H "Content-Type: application/json" -d '{"event":"trip_created","tripId":"ID"}'
# HEAD tidak mengarah ke kontak: harus 204 tanpa Location
curl -I https://URL/go/ID
```

### Menguji validasi server dengan curl

Ganti `URL-VERCEL`. Hasil yang benar: status `400` dan pesan error per field (tujuan terlalu panjang, tanggal pulang sebelum berangkat); database tidak disentuh.

```bash
curl -i -X POST https://URL-VERCEL/api/trips \
  -H "Content-Type: application/json" \
  -d '{"type":"rencana","destination":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","creatorName":"Billy","tags":["foodie"],"contactType":"whatsapp","contactValue":"081234567890","startDate":"2099-01-05","endDate":"2099-01-01","deviceId":"3f2b8c1e-5a47-4d0e-9a3b-1c2d3e4f5a6b"}'
```
