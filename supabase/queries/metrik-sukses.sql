-- Trip Card: kueri metrik sukses (Tahap 6)
-- Cara pakai: Supabase > SQL Editor > New query. Tempel SATU kueri di bawah
-- (dari "-- KUERI n" sampai titik koma), lalu klik Run. Bila kamu menjalankan
-- seluruh isi file sekaligus, SQL Editor hanya menampilkan hasil kueri TERAKHIR
-- (Kueri 5, ringkasan tiga metrik). Kueri hanya membaca (select), aman dijalankan ulang.
--
-- Catatan membaca angka:
-- * Semua angka berbasis EVENT, bukan pengunjung unik: aplikasi sengaja tidak
--   menyimpan data pribadi (tanpa IP, cookie, atau ID perangkat) di tabel events.
-- * Klik "Hubungi" yang kamu lakukan sendiri saat menguji trip ikut terhitung.
--   Hapus trip uji dari tabel trips, lalu bersihkan barisnya di events bila perlu:
--   delete from public.events where trip_id = 'ID_TRIP_UJI';
-- * Hari dihitung menurut zona waktu Asia/Jakarta.


-- =========================================================================
-- KUERI 1: funnel per jenis trip dan per hari
-- Jumlah tiap dari enam event. Baris terbaru di atas.
-- =========================================================================
select
  (created_at at time zone 'Asia/Jakarta')::date as hari,
  coalesce(trip_type, '(tanpa jenis)')           as jenis_trip,
  count(*) filter (where event = 'form_opened')     as form_opened,
  count(*) filter (where event = 'trip_created')    as trip_created,
  count(*) filter (where event = 'card_downloaded') as card_downloaded,
  count(*) filter (where event = 'link_copied')     as link_copied,
  count(*) filter (where event = 'detail_viewed')   as detail_viewed,
  count(*) filter (where event = 'contact_clicked') as contact_clicked
from public.events
group by 1, 2
order by 1 desc, 2;


-- =========================================================================
-- KUERI 2: persentase pengguna menyelesaikan form
-- trip_created ÷ form_opened, per jenis dan total (baris "TOTAL").
-- Jumlah event, bukan pengunjung unik. Bisa melewati 100% bila ada trip yang
-- dibuat tanpa event form_opened tercatat (mis. pemblokir skrip di browser).
-- =========================================================================
select
  case when grouping(trip_type) = 1 then 'TOTAL'
       else coalesce(trip_type, '(tanpa jenis)') end as jenis_trip,
  count(*) filter (where event = 'form_opened')  as form_opened,
  count(*) filter (where event = 'trip_created') as trip_created,
  round(
    100.0 * count(*) filter (where event = 'trip_created')
          / nullif(count(*) filter (where event = 'form_opened'), 0),
    1
  ) as persen_selesai_form
from public.events
group by rollup (trip_type)
order by grouping(trip_type), jenis_trip;


-- =========================================================================
-- KUERI 3: persentase kartu yang diunduh ATAU linknya disalin
-- Jumlah trip_id UNIK dengan event card_downloaded atau link_copied, dibagi
-- jumlah trip yang tercatat trip_created. Hanya trip yang punya event
-- trip_created yang dihitung (trip lama sebelum Tahap 6 tidak ikut).
-- =========================================================================
with dibuat as (
  select trip_id, min(trip_type) as trip_type
  from public.events
  where event = 'trip_created' and trip_id is not null
  group by trip_id
),
dibagikan as (
  select distinct trip_id
  from public.events
  where event in ('card_downloaded', 'link_copied') and trip_id is not null
)
select
  case when grouping(d.trip_type) = 1 then 'TOTAL'
       else coalesce(d.trip_type, '(tanpa jenis)') end as jenis_trip,
  count(*)                                       as trip_dibuat,
  count(b.trip_id)                               as trip_diunduh_atau_disalin,
  round(100.0 * count(b.trip_id) / nullif(count(*), 0), 1) as persen_diunduh_atau_disalin
from dibuat d
left join dibagikan b on b.trip_id = d.trip_id
group by rollup (d.trip_type)
order by grouping(d.trip_type), jenis_trip;


-- =========================================================================
-- KUERI 4: trip yang menerima setidaknya satu klik Hubungi
-- Jumlah trip_id UNIK dengan event contact_clicked, plus persentasenya
-- terhadap trip yang tercatat trip_created. Klik Hubungi darimu sendiri
-- (menguji trip sendiri) ikut terhitung.
-- =========================================================================
with dibuat as (
  select trip_id, min(trip_type) as trip_type
  from public.events
  where event = 'trip_created' and trip_id is not null
  group by trip_id
),
dihubungi as (
  select distinct trip_id
  from public.events
  where event = 'contact_clicked' and trip_id is not null
)
select
  case when grouping(d.trip_type) = 1 then 'TOTAL'
       else coalesce(d.trip_type, '(tanpa jenis)') end as jenis_trip,
  count(*)                                       as trip_dibuat,
  count(c.trip_id)                               as trip_dengan_klik_hubungi,
  round(100.0 * count(c.trip_id) / nullif(count(*), 0), 1) as persen_dengan_klik_hubungi
from dibuat d
left join dihubungi c on c.trip_id = d.trip_id
group by rollup (d.trip_type)
order by grouping(d.trip_type), jenis_trip;


-- =========================================================================
-- KUERI 5: ringkasan tiga metrik sukses (total semua jenis, satu baris)
-- Sama dengan baris TOTAL di Kueri 2, 3, dan 4.
-- =========================================================================
with dibuat as (
  select distinct trip_id
  from public.events
  where event = 'trip_created' and trip_id is not null
),
dibagikan as (
  select distinct trip_id
  from public.events
  where event in ('card_downloaded', 'link_copied') and trip_id is not null
),
dihubungi as (
  select distinct trip_id
  from public.events
  where event = 'contact_clicked' and trip_id is not null
),
form as (
  select
    count(*) filter (where event = 'form_opened')  as form_opened,
    count(*) filter (where event = 'trip_created') as trip_created
  from public.events
)
select
  form.form_opened,
  form.trip_created,
  round(100.0 * form.trip_created / nullif(form.form_opened, 0), 1) as "1_persen_selesai_form",
  (select count(*) from dibuat d join dibagikan b using (trip_id)) as trip_diunduh_atau_disalin,
  round(
    100.0 * (select count(*) from dibuat d join dibagikan b using (trip_id))
          / nullif((select count(*) from dibuat), 0),
    1
  ) as "2_persen_diunduh_atau_disalin",
  (select count(*) from dibuat d join dihubungi c using (trip_id)) as trip_dengan_klik_hubungi,
  round(
    100.0 * (select count(*) from dibuat d join dihubungi c using (trip_id))
          / nullif((select count(*) from dibuat), 0),
    1
  ) as "3_persen_dengan_klik_hubungi"
from form;
