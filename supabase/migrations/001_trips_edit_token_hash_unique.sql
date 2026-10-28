-- Tahap 4: indeks UNIQUE pada trips.edit_token_hash.
-- Dipakai untuk mencari trip dari hash token edit (halaman /edit/[token]) dan
-- menjamin satu token hanya cocok dengan satu trip. Aman dijalankan ulang.
-- Jalankan di Supabase > SQL Editor. Hasil yang benar: "Success. No rows returned".

create unique index if not exists trips_edit_token_hash_key
  on public.trips (edit_token_hash);
