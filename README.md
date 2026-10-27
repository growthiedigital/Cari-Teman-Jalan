# Trip Card

Aplikasi web tanpa login untuk orang yang cari teman jalan: isi form singkat, dapat kartu trip untuk dibagikan ke media sosial, dan halaman detail publik dengan tombol Hubungi.

> **Status: Tahap 0 (fondasi).** Baru ada halaman awal, skema database, dan pengecekan kesehatan (`/api/health`). Fitur utama dibuat di tahap berikutnya.

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
- Perintah: `npm run dev`, `npm run build`, `npm run lint`.
