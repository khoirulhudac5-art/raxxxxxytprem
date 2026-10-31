# Aktivasi dan deploy Rakyat Premium

Katalog `/` dan Admin `/admin` membaca Supabase. Saat sakelar nonaktif, Admin
baca-saja; tidak ada fallback penyimpanan produk ke localStorage. Pengaturan
WhatsApp dibaca dari `store_settings` dengan ID `main`, tanpa mengubah isinya.
Data browser lama tidak dihapus. Login dan RLS tetap digunakan.

## Status aktivasi

Implementasi CRUD yang sudah ada menggunakan `revision` untuk menolak edit/hapus
berdasarkan data lama dan `sort_order` untuk posisi produk baru. Pengguna telah
mengonfirmasi migrasi produksi berhasil: `migration_checks_passed`, 7 produk,
14 paket dan `initial_revisions_passed=true`. Jangan jalankan ulang migrasi.
Konfigurasi `.env.local` sudah mengaktifkan CRUD untuk URL Supabase existing.
Uji tulis produksi masih menunggu persetujuan khusus pengujian satu produk baru.

Konfigurasi aktivasi pada setiap environment:
`SUPABASE_PRODUCT_CRUD_ENABLED=true` dan isi `SUPABASE_PRODUCT_CRUD_APPROVED_URL`
sama persis dengan `NEXT_PUBLIC_SUPABASE_URL`. Tanpa kedua nilai ini penulisan ditolak.
Flag lama `SUPABASE_PRODUCT_CRUD_TEST_URL` tidak lagi mengaktifkan CRUD.

## Deploy melalui repository GitHub yang sudah ada

1. Masukkan perubahan lokal ini ke repository GitHub yang digunakan proyek ini.
   Folder sesi ini tidak menyediakan `.git/config`, sehingga remote/branch belum
   dapat dipastikan. Jangan membuat repository baru.
2. Pada proyek Vercel yang terhubung repository tersebut, gunakan preset Next.js,
   build `npm run build`, dan environment URL/publishable key Supabase yang sama
   dengan konfigurasi lokal. Jangan masukkan service-role key atau password database.
3. Setelah uji CRUD produksi berhasil, deploy dengan `SUPABASE_PRODUCT_CRUD_ENABLED=true`
   dan `SUPABASE_PRODUCT_CRUD_APPROVED_URL` sama dengan URL Supabase. Pastikan katalog,
   gambar, paket/harga, nomor dan template WhatsApp benar dari perangkat lain,
   serta login Admin berfungsi. Sesuaikan URL situs/redirect Auth bila diperlukan.
4. Uji menggunakan satu produk baru: tambah, edit, pastikan terlihat di katalog
   publik/perangkat lain, lalu hapus hanya produk uji. Jangan ubah tujuh produk lama.
   Login Admin dan RLS tetap dipakai, tanpa service-role key. Pengujian ini juga
   memerlukan persetujuan penulisan sebelum dimulai.

Katalog membaca database saat dibuka, saat tab kembali fokus, dan setiap 5 detik
selama tab terlihat. Ini bukan pembaruan seketika melalui Realtime.

Rollback aplikasi: nonaktifkan flag dan redeploy agar Admin kembali baca-saja.
Tidak perlu mereset atau menghapus database.

## Pemeriksaan lokal

`npm run typecheck`, `npm run build`, dan:

```
node scripts/test-product-crud.cjs
node scripts/test-shared-product-source.cjs
node scripts/test-supabase-products.cjs
node scripts/test-crud-schema-preparation.cjs
```

Tes CRUD menggunakan mock, tanpa penulisan produksi.
