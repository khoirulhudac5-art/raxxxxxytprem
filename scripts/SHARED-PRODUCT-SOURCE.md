# Sumber produk bersama — mode pengujian saja

Alur preview publik dan Admin:
client SSR existing -> fetchSupabaseProducts (SELECT) -> mapSupabaseProducts ->
readSharedProducts -> urutan bersama -> state hook -> komponen UI existing.

readSharedProducts berada di src/lib/supabase/product-source.ts. Adapter tidak memiliki
writer, fallback contoh, akses localStorage, atau cache permanen. Urutan tujuh ID dari
backup migrasi dipakai bersama; array paket, teks, harga, URL gambar tetap sama.
Urutan input ID lain stabil mengikuti reader (saat ini id ascending). Urutan produk
baru yang benar-benar dapat diatur Admin memerlukan desain persistensi tahap berikutnya.

Kedua halaman tidak lagi menyuplai urutan localStorage masing-masing ke hook preview.
Dengan demikian perangkat dengan array lokal berbeda tetap mendapat urutan preview
yang sama. Mode normal tetap memakai useProducts lokal; tidak ada perpindahan sumber.
readStoredCatalog/compareCatalogs tetap tersedia untuk perbandingan read-only, bukan
mekanisme sinkronisasi. Tidak ada data lokal yang diunggah ke Supabase.

## URL

- Publik normal: / (localStorage)
- Publik preview development: /?source=supabase-preview (SELECT tanpa login tersedia)
- Admin normal: /admin (localStorage, setelah guard server)
- Admin preview: /admin?source=supabase-preview (SELECT, read-only produk)

Guard server getUser + is_admin tidak berubah. Menambahkan parameter source tidak
melewati pemeriksaan. Tombol dan handler produk Admin preview tetap tidak menulis.
Status idle/loading/ready/error/empty/retry sama melalui hook bersama. Empty berarti
tidak ada baris yang terlihat oleh role, bukan bukti tabel fisik kosong. Error tidak
menampilkan daftar lokal/contoh sebagai pengganti.

## Refresh (belum tersambung CRUD)

useCatalogPreview mengembalikan refresh dan retry. Preview membaca ulang ketika tab
kembali fokus. refreshSupabaseProducts() memberi notifikasi pada hook aktif di tab
yang sama dan BroadcastChannel pada tab browser/origin yang sama bila tersedia.
Pesan hanya berisi invalidasi, tidak ada produk/key/token. Tanpa BroadcastChannel,
refresh satu tab dan pembacaan ketika fokus tetap tersedia. Listener dibersihkan saat
hook dinonaktifkan/unmount; respons request lama tidak mengganti request terbaru.

Belum ada handler CRUD yang memanggil invalidasi. Pada tahap penulisan nanti:
otorisasi server -> validasi -> database mengonfirmasi perubahan -> refresh/invalidate
-> baca data terkini. Jangan invalidasi seolah sukses ketika penyimpanan gagal.
BroadcastChannel tidak mencakup perangkat lain; perangkat lain membaca lagi saat
fokus/reload/retry. Sinkronisasi langsung ketika halaman diam terbuka memerlukan
polling atau Realtime di tahap terpisah, tidak diaktifkan sekarang.

## Dampak backup dan WhatsApp

Export Backup normal masih mengekspor data lokal dan mencatat source localStorage.
Admin preview tetap tidak menampilkan ekspor lokal agar tidak disangka backup DB.
Sebelum cutover, perlu ekspor Supabase yang mengambil hasil reader terkini dan
memberi provenance source yang benar; jangan menyebut salinan lokal sebagai backup DB.
Backup lama tetap disimpan dan tidak ditimpa.

WhatsApp belum dipindahkan: nomor/template pada katalog dan Admin masih berasal
dari localStorage, meskipun produk preview berasal dari Supabase. Karena itu, hasil
pesan/tujuan bisa berbeda antarperangkat. Sebelum sumber utama dialihkan, siapkan
reader store_settings id main beserta mapping/validasinya dan persetujuan aktivasi.
Jangan mengunggah pengaturan lokal otomatis atau mencampur kedua sumber tanpa label.

## Pengujian

```
node scripts/test-shared-product-source.cjs
node scripts/test-catalog-preview.cjs
node scripts/test-admin-preview.cjs
node scripts/test-preview-mode.cjs
node scripts/test-admin-auth.cjs
npm.cmd run typecheck
npm.cmd run build
```

SELECT live anon opsional:
```
node --env-file=.env.local scripts/test-shared-product-source.cjs --live
```

Uji lokal memeriksa kedua konsumen mendapat 7 produk/14 paket dan urutan yang sama,
error/empty, reread tanpa cache data usang, invalidasi/unsubscribe, mode normal dan
handler Admin preview yang tetap diblokir. Uji live membandingkan seluruh field
dengan backup. Tidak melakukan login nyata, DML atau perubahan storage produksi.
BroadcastChannel antar-tab browser dan sesi Admin aktual masih perlu uji manual.

## Sebelum aktivasi CRUD

Tetapkan urutan persisten dan kontrol konflik antarperangkat, kontrak operasi server
per ID dengan pemeriksaan Admin/RLS setiap request, retry idempoten, backup DB, dan
rollback aplikasi yang mempertimbangkan data DB terbaru. Siapkan lingkungan uji
terpisah untuk DML. Jangan menjalankan ulang migrasi 7 produk atau memakai upsert
untuk menimpa data existing. Default privileges tetap pekerjaan keamanan terpisah.
