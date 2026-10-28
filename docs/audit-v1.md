# Audit akhir v1 (Tahap 7)

Audit dan perapian Trip Card v1. Tidak ada fitur baru. Dibuat dengan membaca seluruh kode (`src/`, `supabase/`, `public/robots.txt`, `next.config.ts`, README), menjalankan build produksi lokal tanpa database, dan menambah uji otomatis.

**Cara membaca kolom "Bukti":** `kode` = dibaca dan ditelusuri di kode (file:baris); `lokal` = diperiksa dengan `curl`/browser ke build produksi lokal **tanpa database** (jalur yang tidak butuh DB); `uji` = uji otomatis (Vitest, termasuk Postgres tertanam PGlite, **bukan** Supabase sungguhan); `BELUM` = butuh Supabase/Vercel/HP sungguhan dan tidak diverifikasi di sini.

## Ringkasan

| Tingkat | Jumlah | Keterangan |
| --- | --- | --- |
| Tinggi | 0 | Tidak ada jalur yang membocorkan kontak, token, atau data pribadi; tidak ada penulisan tanpa izin ke trip orang lain. |
| Sedang | 1 | S1: tiga endpoint publik tanpa pembatasan laju. **Menunggu keputusan Billy.** |
| Rendah | 9 | R1-R9. Semua dilaporkan, tidak ada yang diubah perilakunya (butuh keputusan produk atau di luar lingkup perapian). |
| Informasi | 2 | I1-I2, bukan cacat. |
| Cacat non-keamanan, **sudah diperbaiki** | 4 | F1-F4 (teks Inggris di halaman galat, `npm run typecheck` gagal di checkout baru, klaim README salah, kode mati). |

Satu-satunya temuan "sedang" (S1) sengaja tidak diperbaiki karena solusinya adalah keputusan (aturan firewall di Vercel atau penyimpanan penghitung), bukan perbaikan kecil.

Fitur di luar brief: **tidak ada** fitur dari daftar "sengaja belum dibuat". Tiga hal pendukung yang tidak disebut eksplisit di brief tapi wajar dan sudah disetujui di tahap sebelumnya dicatat di bagian 1.

---

## 1. Inventaris route dan kepatuhan terhadap brief

Daftar ini cocok dengan keluaran `next build` (16 entri, termasuk `/_not-found` yang dipakai untuk 404) ditambah `robots.txt` dan `favicon.ico`. Kolom "DB" memuat tabel dan kolom yang dibaca (R) atau ditulis (W).

| Path | Metode | Fungsi | Siapa yang bisa mengakses | DB | Di brief? |
| --- | --- | --- | --- | --- | --- |
| `/` | GET | Halaman awal: judul, tombol "Buat trip" dan "Trip saya" | Siapa saja | Tidak ada | Pendukung (pintu masuk) |
| `/buat` | GET | Form buat trip (pilih jenis, isian, pratinjau, kirim) | Siapa saja | Tidak ada | Ya (form) |
| `/sukses?id=` | GET | Layar sukses: kartu, unduh, salin link, link edit | Siapa saja; link edit dibaca dari localStorage pembuat, bukan dari URL | Tidak ada | Ya (kartu, edit) |
| `/trip-saya` | GET | Daftar trip di browser ini | Siapa saja; isi dari localStorage | Tidak ada | Ya (edit tanpa login) |
| `/trip/[id]` | GET | Halaman detail publik + Open Graph | Siapa saja yang tahu ID (10 karakter acak) | R `trips`: 16 kolom publik (`public-columns.ts`), tanpa kontak | Ya |
| `/go/[id]` | GET, HEAD | Tombol Hubungi: redirect 302 ke WhatsApp/Instagram; trip penuh/lewat dialihkan ke `/trip/[id]` | Siapa saja yang tahu ID | R `trips`: `contact_type`, `contact_value`, `is_full`, `type`, `end_date`; W `events` (`contact_clicked`) | Ya |
| `/edit/[token]` | GET | Form edit, status penuh, hapus | Pemegang token edit (43 karakter) | R `trips`: kolom edit termasuk kontak, dicari lewat hash token | Ya |
| `/api/trips` | POST | Buat trip | Siapa saja; dibatasi 5 trip/24 jam per perangkat dan per IP | R `trips` (`created_at` untuk batas); W `trips`; W `events` (`trip_created`) | Ya |
| `/api/trips/edit` | POST | Simpan edit | Pemegang token (di body) | R+W `trips` (hanya kolom `EDITABLE_COLUMNS`) | Ya |
| `/api/trips/status` | POST | Tandai penuh / buka lagi | Pemegang token (di body) | W `trips.is_full` | Ya |
| `/api/trips/delete` | POST | Hapus permanen | Pemegang token (di body) | W `trips` (delete) | Ya |
| `/api/events` | POST | Terima 3 event klien (`form_opened`, `detail_viewed`, `link_copied`) | Siapa saja (tanpa batas laju, lihat S1) | R `trips.type`; W `events` | Ya (analytics) |
| `/api/card/[id]` | GET | Gambar kartu PNG dari `card_snapshot`; `download=1` mencatat `card_downloaded` | Siapa saja yang tahu ID | R `trips.card_snapshot`; W `events` (hanya unduhan) | Ya |
| `/api/card/preview` | POST | Pratinjau kartu dari isian form | Siapa saja (tanpa batas laju, lihat S1) | Tidak ada | Ya (kartu) |
| `/api/health` | GET | Cek koneksi database | Siapa saja | R `trips.id` (limit 1) | Pendukung (operasional, Tahap 0) |
| `/robots.txt`, `/favicon.ico` | GET | Berkas statis | Siapa saja | Tidak ada | Ya |
| Alamat lain (mis. `/trip`, `/feed`, `/sitemap.xml`) | apa pun | 404 | - | Tidak ada | - |

Pemeriksaan "tidak ada daftar/pencarian trip":

- `/trip`, `/go`, `/edit`, `/api`, `/api/card`, `/feed`, `/explore`, `/sitemap.xml` semuanya **404** (`lokal`). `/trip/` dan `/go/` dialihkan 308 ke bentuk tanpa garis miring lalu 404. GET ke endpoint POST (mis. `/api/trips`) membalas 405 (`lokal`).
- Tidak ada file sitemap atau route daftar di repo; `public/` hanya berisi `robots.txt` (`kode`).
- Semua query ke `trips` mengambil satu baris lewat `.eq("id", ...)` atau `.eq("edit_token_hash", ...)` + `.maybeSingle()`; satu-satunya query berderet ada di batas laju (`rate-limit.ts:35`) dan hanya mengambil kolom `created_at` (maks. 5 baris) (`kode`). Dijaga uji `src/lib/audit-guards.test.ts`.
- Tidak ada endpoint yang mengembalikan banyak trip, dan tidak ada `select("*")` (`uji`).

Kelebihan fitur dibanding brief:

| Hal | Penilaian |
| --- | --- |
| `/api/health` | Peninggalan Tahap 0 untuk diagnosis deployment (dipakai di README langkah E). Wajar; risiko kecil dicatat di R3. Tidak dihapus. |
| Dua tema warna kartu dan dua rasio (9:16 / 4:5) | Bagian dari fitur "kartu" Tahap 3. Bukan editor kartu bebas. Tidak diubah. |
| Halaman awal `/` | Hanya pintu masuk ke form dan "Trip saya". Tidak diubah. |

Dari daftar "sengaja belum dibuat": feed/penelusuran, profil/login, tombol Laporkan/moderasi, swipe/skor, verifikasi/rating, chat, AI itinerary, notifikasi/ikuti, editor kartu bebas, dan autocomplete tujuan **tidak ada** di kode (pencarian kata kunci pada `src/`). Footer kontak untuk lapor (`NEXT_PUBLIC_REPORT_CONTACT`) hanya teks/tautan email, bukan tombol Laporkan.

File mati yang dihapus (jelas tidak dipakai, aman): `getClientIp` (`src/lib/trip/secrets.ts`) dan `getCardPadding` (`src/lib/card/spec.ts`); tidak ada pemanggil di `src/` maupun `test/` (`kode`).

---

## 2. Audit akses dan keamanan

Hasil: **aman** kecuali dicatat sebagai temuan.

### 2.1 Kontak (`contact_type`, `contact_value`) tidak bocor: aman

- Kolom kontak hanya disebut di 4 file: `src/app/api/trips/route.ts:40-41` (insert trip baru), `src/lib/trip/edit-columns.ts` (baca/tulis lewat token edit), `src/lib/trip/public-columns.ts:31,37` (daftar kolom untuk `/go`), `src/lib/trip/queries.ts:37-69` (`getTripContact`), ditambah `src/lib/trip/form-values.ts` (mengisi form edit dari baris token). Dijaga uji `audit-guards.test.ts` (`uji`).
- `getTripContact` hanya diimpor oleh `src/app/go/[id]/route.ts:7`. `findTripByToken` (membaca kontak) hanya dipakai `src/app/edit/[token]/page.tsx:23` dan `src/app/api/trips/edit/route.ts:49`, dan hanya mengembalikan baris yang hash tokennya cocok (`edit-queries.ts:24-36`).
- Halaman publik memakai daftar kolom eksplisit tanpa kontak/hash/device/snapshot (`public-columns.ts:9-26`, dipakai `queries.ts:23`). Uji `queries.test.ts:39` memeriksa bahwa query publik memakai persis daftar itu, dan `audit-guards.test.ts` memeriksa bahwa daftar itu tidak memuat kontak/hash/device/snapshot/token. Tidak ada `select("*")` maupun `.select()` kosong di seluruh `src/` (`uji`).
- Open Graph/metadata memakai hanya `title`, `destination`, waktu (`src/app/trip/[id]/page.tsx:26-61`); kartu dibuat dari `card_snapshot` yang tidak memuat nama, kontak, budget, itinerary, catatan (`src/lib/card/snapshot.ts:12-23`).
- Respons JSON: `/api/trips` hanya `{ id, editToken }` (`route.ts:122`), edit `{ id, title }`, status `{ ok, isFull }`, delete `{ ok }`. `/api/events` tanpa body. `/api/card/preview` menerima kontak di body POST (untuk validasi) tetapi tidak menyimpan, tidak mencatat, dan tidak mengembalikannya (`route.ts:46-60`).
- Bundle klien: setelah `next build`, `.next/static` tidak memuat nama variabel rahasia maupun nilai kunci (`lokal`). Nama field `contactValue` ada karena komponen form; nilai kontak tidak bisa diperiksa di bundel karena tidak ada data (bundel statis memang tidak pernah berisi data trip).
- Log: seluruh `console.*` di `src/` hanya memuat label tetap dan kode kasar error (`{ code }` / `{ name }`), tidak pernah token, kontak, body, header, atau objek error utuh (`kode` + `uji`).
- Catatan: halaman `/edit/[token]` memang mengirim kontak ke pemegang token (bagian dari form edit); itu diharapkan.

### 2.2 Token edit: aman, dengan catatan R1

- Hanya hash SHA-256 yang disimpan: `sha256Hex(editToken)` (`api/trips/route.ts:111`), kolom `edit_token_hash` (`schema.sql:11`) berindeks unik. Pencarian selalu lewat `hashEditToken(token)` (`edit-queries.ts:29,50,65,86`). Format token dicek dulu (`edit-link.ts:6`: 43 karakter base64url), sehingga token ngawur tidak menyentuh DB.
- Token mentah hanya ada di: respons `POST /api/trips` (sekali, `no-store`), URL `/edit/{token}`, body POST edit/status/delete, localStorage `tripcard:mytrips` dan cadangan sessionStorage `tripcard:lastcreated` (`local-storage.ts:7,10`). Tidak ada di halaman publik, analytics (`events` hanya 4 kolom, `uji`), metadata, atau log (lihat 2.1).
- `/edit/*`: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` (`next.config.ts:14-19`), ditambah meta `robots noindex` dan `referrer no-referrer` (`edit/[token]/page.tsx:12-16`). Terverifikasi `lokal` pada respons 404 dan 500 halaman edit (header ada di keduanya). `/edit/` dilarang di `robots.txt:4,14` (juga untuk crawler pratinjau; diuji `robots.test.ts`).
- Tautan di halaman edit dan "Trip saya" memakai `prefetch={false}` sehingga token tidak dikirim lewat prefetch.
- **Catatan (R1):** karena token ada di URL, URL itu tercatat di riwayat browser dan kemungkinan di log permintaan Vercel. Kode aplikasi tidak pernah mencatatnya. README lama menyebut "token tidak pernah masuk URL atau log"; itu salah dan sudah dikoreksi (F3).

### 2.3 RLS, kunci, dan modul klien: aman

- `schema.sql:108-109` mengaktifkan RLS pada `trips` dan `events`; **tidak ada** `create policy` di seluruh SQL (`kode`). `schema.sql:112-113` mencabut hak `anon` dan `authenticated`; `service_role` diberi hak (`schema.sql:119-122`).
- Di Postgres tertanam (`uji`, `db-parity.test.ts`): `relrowsecurity = true` untuk kedua tabel, `pg_policies` kosong, `anon`/`authenticated` tanpa hak select/insert/update/delete, `service_role` punya semuanya, dan kolom `events` hanya `id, event, trip_type, trip_id, created_at`. **Belum** diverifikasi di proyek Supabase sungguhan (README langkah E.3 memberi cara mengujinya).
- Tidak ada pemakaian kunci anon/publishable di kode, `.env.example`, maupun `next.config.ts` (`uji`). Hanya dua variabel `NEXT_PUBLIC_`: `NEXT_PUBLIC_REPORT_CONTACT` dan `NEXT_PUBLIC_SITE_URL`, keduanya memang publik (`uji`).
- `src/lib/supabase/server.ts:1` memakai `import "server-only"`; semua modul yang membaca `SUPABASE_SERVICE_ROLE_KEY` atau `IP_HASH_SALT` juga `server-only` (`uji`). Tidak ada berkas `"use client"` yang membaca `process.env` (`uji`). Build tidak memuat klien Supabase di `.next/static` (`lokal`).
- Riwayat git dipindai: tidak ada kunci/JWT yang ter-commit (`lokal`).

### 2.4 Validasi server, batas panjang, escape: aman

- Setiap endpoint penulisan memvalidasi di server sebelum menyentuh DB: `api/trips/route.ts:79` (`validateTrip`), `api/trips/edit/route.ts:46,59` (token lalu `validateTripEdit`), `api/trips/status/route.ts:48-50` (token, boolean ketat), `api/trips/delete/route.ts:42` (token), `api/card/preview/route.ts:26,46` (rasio, `validateTrip`), `api/events/route.ts:28,35` (nama event, id) (`kode` + `uji`). Semua membatasi ukuran body (20.000 / 2.000 / 500 karakter) dan mengembalikan pesan generik untuk galat server.
- Batas panjang skema = constraint DB (`uji`, `db-parity.test.ts`, di PGlite dengan `schema.sql` asli): tujuan 60, judul 80, nama 30, catatan 200, itinerary 500, niat 200, jumlah teman 1-10, budget 0..100.000.000 (kolom int), 1-3 tag dari 7 nilai, tanggal pulang >= berangkat, bulan jenis niat selalu tanggal 1. Tepat di batas lolos di keduanya, satu di atasnya ditolak di keduanya; emoji dihitung per code point seperti `char_length`; judul otomatis ("Trip ke " + tujuan 60 karakter = 68) muat; kontak terpanjang yang lolos validasi (15 digit / 30 huruf) muat di `contact_value` (maks. 60).
- Tidak ada `dangerouslySetInnerHTML` atau `innerHTML=` di `src/` (`uji`); teks pengguna dirender sebagai teks React (otomatis di-escape), termasuk `<title>`/Open Graph lewat API metadata Next.js dan teks di gambar kartu (JSX untuk satori; emoji dibuang, `spec.ts:141`). Fixture teks terpanjang (judul 80, tujuan 60 karakter) dicakup `render-card.test.ts`, dan uji "emoji tidak memicu pengambilan jaringan" ada di berkas yang sama.
- Nama berkas unduhan `Content-Disposition` hanya berisi id (base62 tervalidasi) dan rasio (daftar tetap) (`api/card/[id]/route.ts:60`): tidak ada injeksi header.

### 2.5 `/go/[id]`: aman

- Tujuan hanya `https://wa.me/{10-15 digit}` atau `https://instagram.com/{[A-Za-z0-9._]{1,30}}` (`contact-url.ts:12-20`); nilai dari DB divalidasi ulang, bentuk aneh = 404. Tidak ada parameter query/path yang masuk ke URL tujuan, jadi tidak ada open redirect. Satu-satunya redirect lain adalah relatif ke `/trip/{id}` dengan `id` yang sudah lolos pola base62 (`go/[id]/route.ts:48-55`).
- Trip penuh/lewat dialihkan ke `/trip/{id}`, tidak ke kontak (`route.ts:43-55`).
- `HEAD` selalu 204 tanpa `Location` dan tanpa menyentuh DB (`route.ts:78-80`; `lokal`: 204). `GET` mencatat `contact_clicked` hanya bila bukan prefetch (`Purpose`/`Sec-Purpose`) dan bukan bot, hanya pada jalur yang benar-benar mengalihkan ke kontak (`route.ts:63-69`). Respons: `Cache-Control: no-store`, `X-Robots-Tag: noindex` (`lokal`).
- Catatan kecil (I1): redirect ke WhatsApp/Instagram meneruskan header `Referer` berisi alamat halaman trip yang publik. Tidak sensitif.

### 2.6 Batas laju dan analytics: aman sesuai desain; lihat R5 dan S1

- Batas 5/24 jam: `MAX_TRIPS_PER_WINDOW = 5` (`rate-limit.ts:6`), jendela bergulir; hitung per `device_id` ATAU per hash IP; 429 + `Retry-After` (`api/trips/route.ts:100-108`). **IP tidak diketahui**: hash "unknown" tetap disimpan tetapi **tidak dihitung** (`route.ts:93-98`, `rate-limit.ts:65`), jadi pengguna tanpa IP tidak saling memblokir; hanya batas per perangkat yang berlaku (`uji`: `rate-limit.test.ts`, `route.limit.test.ts`).
- `/api/events` hanya menerima `form_opened`, `detail_viewed`, `link_copied` (`events/route.ts:28`); `trip_created`, `card_downloaded`, `contact_clicked` ditolak 400 (`lokal` untuk `trip_created`). `trip_type` untuk event dengan trip selalu dari DB (`route.ts:73-86`), nilai klien diabaikan; trip tidak ada = tidak dicatat; bot = tidak dicatat.
- Tabel `events` tidak berisi data pribadi: kolom hanya `id, event, trip_type, trip_id, created_at` (`uji`), dan `recordEvent` hanya menulis tiga kolom itu (`record-event.ts:26-28`).

### 2.7 Header dan robots: aman

| Permintaan | Hasil | Bukti |
| --- | --- | --- |
| Halaman detail `noindex` | `robots: { index: false, follow: false }` untuk trip ada maupun tidak (`trip/[id]/page.tsx:29`); halaman 404 trip juga `noindex` | `kode`, `lokal` |
| `/go/` | `robots.txt` melarang untuk semua agen; respons `X-Robots-Tag: noindex` | `kode`, `lokal` |
| `/edit/` | Dilarang di `robots.txt` untuk semua agen; `noindex, nofollow` via header dan meta | `kode`, `lokal`, `uji` |
| `/api/card/` | Tidak dilarang untuk agen mana pun (crawler pratinjau bisa mengambil gambar) | `kode`, `uji` (`robots.test.ts`) |
| `/trip/` | Dilarang untuk `*`; dibuka untuk WhatsApp, `facebookexternalhit`, `meta-externalagent`, `Facebot`, `Twitterbot` | `kode`, `uji` |
| Sitemap | Tidak ada | `kode`, `lokal` (404) |

Catatan: dengan `Disallow: /trip/` untuk `*`, mesin pencari tidak membaca `noindex` di halaman itu (R7).

### 2.8 `npm audit`

`npm audit` (tanpa `--force`, dependensi tidak diubah), 28 Okt 2026: **0 kerentanan** (info/rendah/sedang/tinggi/kritis = 0) dari 528 dependensi (56 produksi, 435 dev). `npm audit --omit=dev`: 0. Versi terpasang yang relevan dengan kode yang berjalan: `next@16.4.3`, `react@19.3.0`, `@supabase/supabase-js@2.118.0`, `zod@4.6.7`, `qrcode@1.5.4`. Catatan: `npm audit` hanya mencerminkan basis data advisori npm pada hari itu.

---

## 3. Teks antarmuka berbahasa Indonesia

Semua teks yang terlihat pengguna ditelusuri (halaman, form, pesan error per field, tombol, label tag, penanda status, pesan sukses/gagal, peringatan "kartu tidak ikut berubah", pesan batas 5 trip, halaman tidak ditemukan, footer, `<title>`/Open Graph). `<html lang="id">` sudah benar (`src/app/layout.tsx:23`, `lokal`). Label tetap diperiksa: "Sudah ada rencana", "Cari peminat", "Tertarik / Hubungi", "Sudah penuh", "Sudah lewat", "Trip saya"; kata ganti "kamu" konsisten; nama produk "Trip Card" konsisten di semua `<title>`.

Perubahan teks (sebelum → sesudah), commit "Tahap 7(a)":

| # | Lokasi | Sebelum | Sesudah |
| --- | --- | --- | --- |
| 1 | Label jenis "niat" di pilihan jenis, kepala form, pratinjau, dan halaman edit (`src/lib/trip/constants.ts`) | Masih pengen, cari peminat | Cari peminat (sama dengan halaman detail dan kartu; penjelasan "baru ada keinginan" tetap di deskripsi pilihan) |
| 2 | Halaman 404 umum (alamat tak dikenal, mis. `/trip`; file baru `src/app/not-found.tsx`) | 404 / This page could not be found. | Halaman tidak ditemukan / Alamat yang kamu buka tidak ada. Cek lagi link yang kamu terima. / Ke halaman awal |
| 3 | Halaman galat server (DB bermasalah, dsb.; file baru `src/app/error.tsx`) | This page couldn't load / A server error occurred. Reload to try again. / Reload / ERROR (kode) | Halaman belum bisa dimuat / Terjadi kesalahan di server. Coba lagi beberapa saat lagi. / Coba lagi / Ke halaman awal |
| 4 | Placeholder niat singkat (`trip-fields.tsx`) | mis. Pengen healing ke pantai, santai aja | mis. Pengin healing ke pantai, santai aja |
| 5 | Label kolom tag di form (`trip-fields.tsx`) | Selera trip | Tag selera (sama dengan pratinjau dan pesan error) |
| 6 | Baris pratinjau (`trip-form.tsx`) | Jumlah teman dicari | Jumlah teman yang dicari (sama dengan label form) |
| 7 | Petunjuk kolom kontak saat buat trip (`trip-form.tsx`) | Tidak ditampilkan di kartu. | Tidak ditampilkan di kartu maupun halaman trip. Orang menghubungimu lewat tombol Hubungi. |
| 8 | Link edit di layar sukses (`sukses/edit-link-block.tsx`) | Simpan link ini kalau mau mengedit dari perangkat lain | (sama, dengan titik di akhir) |
| 9 | Footer kontak (`components/report-contact-footer.tsx`) | ...Hubungi halo@contoh.com | ...Hubungi halo@contoh.com. (titik di akhir; kalimat tambahan di layar sukses tetap) |
| 10 | Anggaran di halaman detail (`lib/trip/format.ts`) | Rp 2.500.000 / orang | Rp2.500.000 / orang (disamakan dengan "Rp1.500.000" di pratinjau dan pesan error) |

Istilah serapan yang **sengaja dipertahankan** (bukan teks Inggris yang tertinggal): Trip, Trip Card (nama produk), Link, Itinerary, Budget, Foodie, Story/Feed (pilihan rasio), Tag, QR, "Scan untuk lihat detail" (di gambar kartu), Open Graph (hanya di dokumentasi). Jika Billy ingin padanan Indonesia penuh (mis. "Pindai" untuk "Scan"), itu keputusan teks tersendiri.

Placeholder yang masih bisa terlihat: `[kontak belum diatur]` di footer jika `NEXT_PUBLIC_REPORT_CONTACT` tidak diisi (R9). Itu disengaja agar kekurangan konfigurasi terlihat; README menandainya sebagai "sangat dianjurkan". Tidak ada teks sisa pengembangan lain (pencarian "TODO", "FIXME", "lorem", "coming soon", "Next.js", "Vercel", "Supabase" pada teks tampil: nihil; kata "placeholder" hanya muncul sebagai atribut contoh isian seperti "mis. Labuan Bajo").

Pesan error server/endpoint yang bukan untuk mata pengguna biasa (mis. "Parameter r harus 9x16 atau 4x5.", respons `/api/health`) berbahasa Indonesia/teknis dan tidak diubah.

---

## 4. Kelengkapan README

| Butir yang diminta | Status |
| --- | --- |
| Urutan setup dari nol: Supabase | Bagian A-C |
| Urutan `schema.sql` lalu **semua** migrasi | Bagian B, diperjelas (migrasi 001, proyek baru vs lama, migrasi masa depan) |
| Vercel | Bagian D |
| Daftar lengkap variabel lingkungan dan tujuannya (5 variabel) + catatan redeploy untuk `NEXT_PUBLIC_*` | Bagian D, jadi satu tabel (wajib?/fungsi/isi) |
| Hapus trip manual lewat dashboard Supabase | Bagian F (baru) |
| Jalankan `metrik-sukses.sql` dan baca hasilnya | Bagian H (dipindah ke panduan, ditambah tabel arti kolom) |
| Uji status "Sudah lewat" lewat SQL | Bagian G (dipindah ke panduan, dilengkapi harapan hasil) |
| Batasan v1 yang diketahui | Bagian "Batasan v1 yang diketahui" (baru) |

Koreksi isi README yang salah: status Tahap 6 di kepala dokumen (kini "v1 selesai"); halaman awal "sedang disiapkan" (tidak benar lagi); "token tidak pernah masuk URL atau log" (salah, lihat F3); `robots.txt` hanya melarang `/go/` dan `/trip/` (kini juga `/edit/`); `/api/health` tidak mengecek `IP_HASH_SALT` (ditambahkan peringatan); `npm run typecheck` (lihat F2).

Verifikasi perintah dan nama variabel (`uji`, `src/lib/trip/readme-commands.test.ts`, memakai teks yang diambil langsung dari README): urutan `schema.sql` + migrasi berjalan dan aman diulang; uji kunci anon (`set role anon` ditolak); kueri cek dan hapus trip (F) serta hapus `events`; tiga pernyataan SQL "Sudah lewat" (G) menghasilkan tanggal pulang kemarin menurut Jakarta dan bisa dikembalikan; kelima nama variabel ada di README dan `.env.example`; kueri 1-5 dan nama kolom hasil di H ada di `metrik-sukses.sql`; contoh `curl` validasi menghasilkan tepat galat `destination` dan `endDate`. Perintah `npm run dev/build/lint/typecheck/test` ada di `package.json`. Contoh `curl` ke situs yang sudah dideploy tidak bisa dijalankan di sini (`BELUM`), kecuali yang tidak butuh DB (HEAD `/go`, event server-only ditolak, 404 ID ngawur; `lokal`).

---

## 5. Temuan

### Sedang

**S1. Tiga endpoint publik tanpa pembatasan laju, dua di antaranya mengerjakan hal berat.** `POST /api/card/preview` merender PNG tanpa DB (`api/card/preview/route.ts:54`); `GET /api/card/{id}` merender PNG dan membaca DB, dan parameter query yang berbeda-beda (`?r=4x5&x=1`, `x=2`, ...) menghindari cache CDN sehingga tiap permintaan merender ulang; `POST /api/events` menulis satu baris `events` per permintaan dan UA bisa dipalsukan. Dampak: kuota/biaya fungsi Vercel dan Supabase bisa terkuras, tabel `events` bisa membengkak, dan angka metrik bisa digelembungkan oleh pihak yang sengaja. Tidak ada kebocoran data. **Menunggu keputusan Billy.** Opsi tanpa kode: aturan rate limit di Vercel Firewall pada path `/api/card/*` dan `/api/events`. Opsi kode: penghitung per-IP di database (butuh keputusan soal penyimpanan IP-hash lagi) atau memadatkan parameter query kartu. Tidak diperbaiki karena bukan perbaikan kecil.

### Rendah (menunggu keputusan, tidak diubah)

- **R1. Token edit ada di URL.** Muncul di riwayat browser dan (belum diverifikasi) di log permintaan Vercel yang hanya dibuka anggota proyek. Kode tidak mencatatnya; header `no-store`/`no-referrer`/`noindex` sudah dipasang. Hanya mengubah desain (mis. token di `#fragment`) yang menghilangkannya.
- **R2. Tidak ada header keamanan global** (`X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, CSP). Halaman bisa dibingkai situs lain (clickjacking terhadap tombol Hubungi/Hapus trip). Perbaikan kecil di `next.config.ts`, tetapi memengaruhi perilaku (mis. tampilan dalam browser aplikasi), jadi diserahkan ke keputusan.
- **R3. `/api/health` publik:** membuka satu query DB per permintaan, membocorkan kode kasar penyebab kegagalan konfigurasi (`env_kosong`, `tabel_tidak_ada`, dsb.), dan tetap hijau walau `IP_HASH_SALT` kosong (padahal simpan trip jadi 500). Peringatan terakhir sudah masuk README.
- **R4. Hash IP = SHA-256(IP + salt), bukan HMAC.** Ruang IPv4 kecil: bila `IP_HASH_SALT` bocor, hash IP bisa dibalikkan lewat brute force. Salt rahasia dan IP hanya dipakai untuk batas laju.
- **R5. Batas 5 trip/24 jam bisa dilewati** (ganti `device_id`, hapus data browser; tidak atomik; IP seluler bersama). Sudah didokumentasikan sejak Tahap 6.
- **R6. Body POST diterima apa pun `Content-Type`-nya** (`request.text()` lalu `JSON.parse`), sehingga form lintas-situs bisa memicu pembuatan trip dari browser pengunjung. Tidak ada kredensial ambient (token ada di body) dan batas per IP tetap berlaku; dampaknya spam yang sama dengan memanggil API langsung.
- **R7. `Disallow: /trip/` untuk semua agen** membuat mesin pencari tidak membaca `noindex`; URL trip yang tersebar bisa muncul tanpa deskripsi, dan Telegram/Slack/Discord mungkin tidak menampilkan pratinjau. Keputusan produk (bahwa pratinjau hanya untuk WhatsApp/Meta/Twitter) berasal dari Tahap 3.
- **R8. Kartu trip yang dihapus** bisa tampil di CDN sekitar satu jam (`s-maxage=3600`), plus satu permintaan basi karena `stale-while-revalidate=86400` (`api/card/[id]/route.ts:16`). Isi kartu tidak memuat nama/kontak. Dicatat di README bagian F.
- **R9. Fallback `[kontak belum diatur]`** tampil ke semua pengunjung bila `NEXT_PUBLIC_REPORT_CONTACT` kosong.

### Informasi

- **I1.** Redirect `/go/{id}` meneruskan `Referer` (alamat halaman trip, publik) ke WhatsApp/Instagram.
- **I2.** `/sukses` dan `/buat` bisa diindeks mesin pencari; keduanya tanpa data pribadi.

### Cacat non-keamanan yang sudah diperbaiki

- **F1.** Alamat tak dikenal (mis. `/trip`) dan galat server menampilkan halaman bawaan Next.js berbahasa Inggris. Ditambah `not-found.tsx` dan `error.tsx` berbahasa Indonesia; terverifikasi `lokal` (404 dan 500 karena DB sengaja tak tersambung).
- **F2.** `npm run typecheck` gagal di checkout baru (`Cannot find name 'PageProps'`, tipe dibuat `next build`). Sekarang `next typegen && tsc --noEmit`; terverifikasi dari `.next` kosong.
- **F3.** README menyebut token "tidak pernah masuk URL atau log" dan kepala dokumen/halaman awal usang. Dikoreksi.
- **F4.** Kode mati `getClientIp` dan `getCardPadding` dihapus.

---

## 6. Verifikasi dan yang belum terverifikasi

Dijalankan setelah semua perubahan (lihat laporan akhir untuk hasil dan angka): `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (termasuk uji baru: `db-parity.test.ts`, `audit-guards.test.ts`, `readme-commands.test.ts`).

**Belum terverifikasi** (butuh Supabase/Vercel/HP sungguhan; tidak ada DB di lingkungan audit):

- Perilaku RLS dan hak akses pada proyek Supabase sungguhan (hanya diuji di Postgres tertanam dengan `schema.sql` yang sama).
- Halaman detail, `/go/{id}`, edit/hapus/status, kartu, dan analytics dengan data nyata; bahwa HTML `/trip/{id}` sungguhan tidak memuat kontak (diuji lewat uji unit dan pembacaan kode, bukan dengan trip sungguhan).
- Header cache CDN Vercel (`s-maxage`, stale-while-revalidate), IP yang diteruskan Vercel lewat `x-forwarded-for`, dan isi log permintaan Vercel.
- Pratinjau link di WhatsApp/Instagram, tampilan di HP (layar kecil, tombol, keyboard), dan browser dalam aplikasi Instagram/TikTok.
- Pengiriman `sendBeacon` dari browser nyata dan pencatatan prefetch/bot oleh jaringan nyata.
- Semua contoh `curl` ke situs yang sudah dideploy di README (kecuali yang disebut `lokal` di atas).
