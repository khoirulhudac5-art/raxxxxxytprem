# Backup data Supabase v2 dan rancangan pemulihan

## Audit schema

products: id/name/description/category/icon/color/badge/image_url text; plans JSONB;
created_at dan updated_at timestamptz. store_settings: id, whatsapp_number,
whatsapp_template text serta updated_at timestamptz. Model aplikasi memakai imageUrl
dan array plans berisi duration/price. Tidak ada kolom sort_order; urutan tampilan
bersama saat ini adalah referensi tujuh ID migrasi di catalog.ts.

Audit berdasarkan snapshot schema existing dan SELECT kolom aktual. Tidak ada
perubahan schema/constraint/grants. Backup tidak mencakup Auth, admin_users, sesi,
password, JWT, API key, schema database, RLS atau grants. Metadata ACL mempunyai
mekanisme snapshot terpisah dan jangan disamakan dengan backup data ini.

## Cara mengunduh

1. Jalankan npm.cmd run dev dengan akses jaringan keluar yang diizinkan.
2. Login menggunakan akun Admin sendiri di /admin/login.
3. Buka http://localhost:3000/admin/backup/supabase.
4. Browser mengunduh rakyat-premium-supabase-backup-<timestamp>.json.
5. Simpan terpisah dari backup lokal lama dan periksa source=supabase, version=2,
   counts.products=7 dan counts.plans=14 untuk dataset saat ini.

Tidak ada tombol/desain baru yang ditambahkan pada Admin/katalog. Endpoint memeriksa
getUser dan is_admin setiap permintaan, memakai client bersesi + publishable key/RLS.
Tanpa login: 401; non-Admin: 403; verifikasi gagal atau data gagal diekspor: 503 dengan
pesan umum. Tidak mengunduh file kosong/parsial. Response private,no-store dan nosniff.
Middleware admin tetap menangani refresh sesi; cookie dari adapter route diteruskan.

## Isi dan validasi

- app, version=2, source=supabase, exportedAt, counts dan warnings.
- Seluruh produk yang terlihat oleh Admin melalui SELECT, dipaginasi dengan count
  exact; semua field aplikasi, URL gambar, createdAt/updatedAt tersimpan.
- productOrder berisi urutan eksplisit yang sama dengan products dan preview bersama.
- plans mempertahankan urutan, durasi, dan angka harga tanpa pembulatan/coercion.
- storeSettings mempertahankan id main, nomor/template WhatsApp dan updatedAt.
  whatsapp menyediakan bentuk number/template yang kompatibel dengan model aplikasi.
- Hanya kolom/field yang diizinkan diserialisasi, tidak menggunakan objek client,
  session, environment atau hasil getUser sebagai bagian backup.
- Produk kosong, ID duplikat, paket rusak/kosong, harga invalid, timestamp invalid,
  pengaturan tidak ada/ganda/invalid atau respons terpotong menggagalkan ekspor.
- Dua pembacaan lengkap harus cocok; JSON hasil serialisasi dibaca kembali untuk
  pemeriksaan counts. Tidak ada fallback localStorage/produk contoh.

## Batas jaminan

Ekspor lewat beberapa request API BUKAN transaksi snapshot PostgreSQL. Dua hasil
identik membantu mendeteksi perubahan bersamaan tetapi tidak membuktikan isolasi
transaksi. consistency dan warnings menyatakan hal ini dalam file. Sebelum CRUD
diaktifkan, dataset saat ini stabil; untuk backup operasional setelah CRUD diperlukan
jendela tanpa penulisan atau rancangan snapshot transaksi yang ditinjau terpisah.
RLS dapat menyaring data; backup mengandalkan policy Admin existing yang mengizinkan
seluruh produk/pengaturan. Nomor/template adalah pengaturan toko, bukan rahasia Auth,
tetapi file backup tetap harus disimpan di tempat yang dikendalikan pemilik.

Gambar dicadangkan sebagai URL, bukan file gambar. Penyedia eksternal dapat menghapus
gambar. Urutan ini adalah urutan aplikasi, bukan urutan fisik SQL. Untuk produk baru,
reader memberi urutan deterministik tambahan; fitur urutan persisten belum dibuat.
Paginasi membutuhkan batas respons API minimal 200; bila lebih rendah dan data lebih
banyak, ekspor menolak hasil parsial. Jangan menganggap backup sumber lokal sebagai
backup database. Pengaturan WhatsApp UI masih lokal; ekspor ini membaca pengaturan DB.

## Rancangan restore — TIDAK DIIMPLEMENTASIKAN/TIDAK DIJALANKAN

Tidak ada endpoint impor/restore atau SQL DML baru. Jangan memberikan file v2 ke
skrip migrasi backup v1 yang lama. Sebelum pemulihan nanti:

1. Validasi format/version/source, seluruh field, counts, ID unik, timestamp,
   productOrder, dan kesesuaian whatsapp/storeSettings. Jangan mempercayai file unggahan.
2. Buat laporan dry-run offline terhadap ekspor database terbaru: missing, identical,
   changed, extra; tampilkan perbedaan harga/paket/URL/WhatsApp tanpa menulis apa pun.
3. Default rencana adalah insert-missing, skip-identical, abort-on-different. Jangan
   menghapus extra atau menimpa changed tanpa persetujuan pemilik per konflik.
4. Pertahankan ID produk serta urutan paket. Pulihkan productOrder melalui mekanisme
   urutan yang saat itu telah disetujui, bukan membuat kolom atau mengurutkan ID diam-diam.
   Pemulihan timestamp/versi harus disesuaikan kontrol konkurensi di tahap CRUD nanti.
5. Ambil backup pra-restore dan uji pada proyek staging terpisah. Periksa akun Admin,
   schema, RLS, grants, dependency/trigger dan side effect. Hindari service-role frontend.
6. Setelah persetujuan terpisah, pilih mekanisme transaksi pemulihan atomik yang
   berotorisasi, dengan lock/kontrol konflik, verifikasi seluruh nilai sebelum commit,
   lalu verifikasi read-only. API request terpisah tidak memberi transaksi multi-tabel.
7. Siapkan pemulihan balik berbasis backup pra-restore; ROLLBACK biasa tidak membatalkan
   data yang sudah COMMIT. Jangan menggunakan localStorage untuk menimpa database.

## Pengujian

```
node scripts/test-supabase-backup.cjs
npm.cmd run typecheck
npm.cmd run build
```

Uji lapisan data read-only opsional:
```
node --env-file=.env.local scripts/test-supabase-backup.cjs --live
```

Uji live hanya SELECT sebagai anon untuk memverifikasi data publik yang dibaca adapter;
tidak mengunduh melalui endpoint Admin, melakukan login, menyimpan file backup, atau
mengubah database. Endpoint export sendiri diuji mock untuk Admin/anon/non-Admin/error.
Unduhan browser dengan sesi Admin nyata masih memerlukan pengujian manual pemilik.
