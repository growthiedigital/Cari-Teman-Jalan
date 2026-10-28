-- Trip Card Generator: skema database (Tahap 0)
-- Jalankan seluruh isi file ini di Supabase > SQL Editor. Aman dijalankan ulang.

-- =========================================================================
-- Tabel trips
-- =========================================================================
create table if not exists public.trips (
  -- id acak 10 karakter base62, dibuat di aplikasi (bukan berurutan)
  id text primary key,
  -- hash SHA-256 dari token edit; token mentah tidak pernah disimpan
  edit_token_hash text not null,
  type text not null check (type in ('rencana', 'niat')),
  destination text not null check (char_length(destination) <= 60),
  title text not null check (char_length(title) <= 80),
  creator_name text not null check (char_length(creator_name) <= 30),
  contact_type text not null check (contact_type in ('whatsapp', 'instagram')),
  contact_value text not null check (char_length(contact_value) <= 60),
  tags text[] not null check (
    cardinality(tags) between 1 and 3
    and tags <@ array[
      'foodie', 'santai', 'budget', 'petualang',
      'foto-foto', 'budaya-sejarah', 'alam'
    ]::text[]
  ),
  buddies_wanted int check (buddies_wanted between 1 and 10),
  note text check (char_length(note) <= 200),
  -- rupiah per orang
  budget int check (budget >= 0),
  itinerary text check (char_length(itinerary) <= 500),
  -- jenis 'rencana'
  start_date date,
  end_date date,
  -- jenis 'niat': selalu tanggal 1 pada bulan terkait
  month_start date check (extract(day from month_start) = 1),
  month_end date check (extract(day from month_end) = 1),
  intention text check (char_length(intention) <= 200),
  theme text not null default 'a',
  card_snapshot jsonb not null default '{}'::jsonb,
  is_full boolean not null default false,
  creator_ip_hash text not null,
  device_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- konsistensi jenis trip
  constraint trips_rencana_dates check (
    type <> 'rencana'
    or (start_date is not null and end_date is not null and end_date >= start_date)
  ),
  constraint trips_niat_months check (
    type <> 'niat'
    or (
      month_start is not null
      and (month_end is null or month_end >= month_start)
    )
  )
);

-- pencarian trip dari hash token edit (Tahap 4); satu token = satu trip.
-- Sama dengan supabase/migrations/001_trips_edit_token_hash_unique.sql.
create unique index if not exists trips_edit_token_hash_key
  on public.trips (edit_token_hash);

-- untuk pembatasan 5 trip/hari per IP dan per perangkat (dipakai nanti)
create index if not exists trips_creator_ip_hash_created_at_idx
  on public.trips (creator_ip_hash, created_at);
create index if not exists trips_device_id_created_at_idx
  on public.trips (device_id, created_at);

-- memperbarui updated_at otomatis setiap baris diubah
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- =========================================================================
-- Tabel events (analytics dasar, tanpa data pribadi)
-- =========================================================================
create table if not exists public.events (
  id bigint generated always as identity primary key,
  event text not null check (event in (
    'form_opened', 'trip_created', 'card_downloaded',
    'link_copied', 'detail_viewed', 'contact_clicked'
  )),
  trip_type text check (trip_type in ('rencana', 'niat')),
  -- sengaja TANPA foreign key: event tetap ada setelah trip dihapus
  trip_id text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Keamanan: Row Level Security
-- =========================================================================
-- RLS diaktifkan TANPA policy sama sekali. Artinya key anon/authenticated
-- (yang bisa terlihat di browser) tidak bisa membaca atau menulis apa pun.
-- Semua akses data hanya lewat server aplikasi memakai service role key,
-- yang melewati RLS. Jangan menambahkan policy untuk anon/authenticated.
alter table public.trips enable row level security;
alter table public.events enable row level security;

-- Lapisan tambahan: cabut juga hak akses langsung untuk anon/authenticated.
revoke all on public.trips from anon, authenticated;
revoke all on public.events from anon, authenticated;

-- Pastikan service_role (dipakai server aplikasi) punya hak akses ke tabel.
-- Di proyek Supabase baru, tabel di schema public tidak selalu otomatis
-- diberi hak akses ke role API, sehingga tanpa baris ini muncul
-- "permission denied for table trips".
grant usage on schema public to service_role;
grant all on public.trips to service_role;
grant all on public.events to service_role;
grant usage, select on all sequences in schema public to service_role;
