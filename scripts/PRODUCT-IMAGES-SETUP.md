# Upload gambar produk

Status: implementasi lokal siap; bucket/policy belum diterapkan atau diverifikasi.
Tidak ada SQL, upload, atau perubahan data produksi yang dijalankan oleh pengembang.

1. Tinjau lalu setujui `scripts/setup-product-images.sql`. Setelah persetujuan, jalankan
   file sekali di SQL Editor proyek Supabase existing. Tidak perlu migrasi produk atau
   perubahan schema. Script berhenti jika bucket sudah ada. is_admin existing harus
   tetap valid seperti konfigurasi login yang sudah berjalan.
2. Verifikasi baca-saja:

```sql
SELECT id,public,file_size_limit,allowed_mime_types
FROM storage.buckets WHERE id='product-images';
SELECT policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
AND policyname LIKE 'product_images_%';
```

Bucket harus public=true, limit=5242880, MIME PNG/JPEG/WebP. File logo publik dapat
langsung dibaca tanpa signed URL, cocok dengan image_url dan reader produk existing.
Listing object dibatasi Admin; public object delivery memang tidak memakai SELECT RLS.
Policy baru tidak mengubah policy testimonials atau tabel produk/paket. Snapshot SQL
memastikan definisi setiap policy Storage existing tetap identik.

3. Login Admin, Tambah/Edit Produk → Pilih Gambar → periksa preview → Upload gambar
   pilihan → Simpan produk. URL lama tetap dapat digunakan melalui input opsional.
   Gambar terunggah tetapi produk belum tersimpan sampai Simpan produk berhasil.
4. Uji menggunakan satu produk uji yang disetujui: upload/publikasi logo, ganti gambar,
   cek katalog dari browser lain, lalu lepas gambar dan simpan. Cek anon/non-Admin tidak
   dapat upload/update/delete melalui API. Pengujian tulis ini belum dijalankan.

Hapus gambar berarti mengosongkan image_url pada draft, kemudian Simpan produk.
File lama tidak dihapus otomatis, termasuk ketika produk dihapus, editor dibatalkan,
atau penyimpanan konflik/gagal. Ini mencegah penghapusan gambar bersama atau file yang
masih direferensikan setelah respons database tidak pasti. File tanpa referensi bisa
tertinggal. Penghapusan fisik melalui sesi aplikasi dinonaktifkan, termasuk untuk
Admin authenticated. Tidak ada policy DELETE permisif baru; guard DELETE restriktif
menolak semua file product-images tanpa bergantung pada visibilitas public.products.
Pengecekan NOT EXISTS lewat URL dihapus karena RLS dapat menyembunyikan produk yang
masih memakai file, URL/CDN bisa berbeda, dan pengecekan tidak atomik dengan simpan.
Aplikasi tetap tidak memanggil remove(). Pembersihan file di masa depan membutuhkan
rancangan/izin terpisah. Dashboard pemilik/service-role yang melewati RLS tetap memiliki
kemampuan administratif; jangan gunakan untuk membersihkan file tanpa pemeriksaan.

Preflight sekarang memakai pemeriksaan helper yang sama dengan setup testimoni:
body is_admin harus cocok dengan baseline, SQL STABLE SECURITY DEFINER, search_path
kosong, hak baca helper ke admin_users dan kemampuan melewati RLS membership valid.
Role anon/authenticated tidak boleh punya BYPASSRLS/superuser atau hak ubah membership,
dan keduanya harus dapat memanggil is_admin. Perbedaan menggagalkan transaksi;
SQL tidak mengubah fungsi helper, login, membership, atau grants existing.

Verifikasi langsung sesudah pemasangan diperlukan: Admin dapat INSERT file baru;
non-Admin/anon ditolak; UPDATE/overwrite/move masuk-keluar bucket ditolak untuk sesi
aplikasi; DELETE ditolak bahkan untuk file tanpa referensi dan sesi Admin. Public
URL gambar tetap dapat dibuka. Ganti/lepas referensi tidak menghapus file lama.
Policy restriktif existing bisa menolak upload yang sah; periksa tanpa mengubah policy
testimonials. Tes lokal/TypeScript/build tidak membuktikan Storage RLS produksi.

Path UUID baru selalu digunakan; upsert dan UPDATE Storage tidak diaktifkan. Jadi
penggantian file tidak pernah menimpa aset yang sudah dipakai. Maksimal 5 MB dan MIME
juga dibatasi bucket; signature file dicek di klien memakai validator yang sama dengan
upload screenshot. Jangan memasukkan screenshot pribadi ke bucket logo publik ini.

Katalog mempertahankan object-fit contain, transparansi PNG, floating dan tilt existing.
Tidak perlu service-role key, deploy, atau perubahan environment.
