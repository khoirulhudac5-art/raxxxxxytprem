# Konfigurasi Testimoni

Status: implementasi lokal tersedia; SQL dan bucket BELUM diterapkan atau diverifikasi.
Tidak ada perubahan pada tabel produk, paket, Auth, atau fungsi is_admin existing.

1. Tinjau `scripts/setup-testimonials.sql`. Setelah menyetujui SQL tersebut, buka SQL
   Editor pada proyek Supabase existing dan jalankan seluruh file sekali. Jangan
   menjalankan ulang migrasi produk. Script berhenti jika tabel/bucket sudah ada.
2. Verifikasi dengan SQL baca-saja di bawah. Harus muncul tabel RLS aktif dan bucket
   privat dengan limit 5242880 serta tiga MIME yang diizinkan:

```sql
SELECT c.relname,c.relrowsecurity FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='testimonials';
SELECT id,public,file_size_limit,allowed_mime_types
FROM storage.buckets WHERE id='testimonials';
SELECT tablename,policyname,cmd FROM pg_policies
WHERE (schemaname='public' AND tablename='testimonials')
OR (schemaname='storage' AND policyname LIKE 'testimonials_storage_%');
SELECT to_regprocedure('public.reorder_testimonials(uuid[])');
```

3. Login Admin, buka `/admin/testimonials`. Upload satu screenshot yang boleh
   dipublikasikan: periksa preview, upload sebagai draft, lalu Publikasikan. Draft
   harus tidak terlihat di browser pengunjung. Uji Naik/Turun dan Hapus. Pemeriksaan
   ini belum dijalankan karena konfigurasi produksi belum diterapkan.

`is_published` ditambahkan untuk membedakan draft/publikasi. `image_url` berisi
referensi stabil `storage://testimonials/<nama-file>`; browser memakai `storage_path`
untuk meminta signed URL yang berlaku lima menit, sehingga tidak menyimpan URL kedaluwarsa.
Galeri membaca ulang setiap 30 detik saat terlihat dan saat kembali fokus.
Signed URL yang sudah diterbitkan dapat dipakai hingga kedaluwarsa meskipun publikasi
kemudian dinonaktifkan. Hapus file jika perlu membatalkan akses gambar tersebut.

Bucket privat menggunakan RLS SELECT untuk gambar terpublikasi dan akses Admin.
Upload tidak menimpa file; JPG/PNG/WebP divalidasi ukuran, MIME, dan signature di klien,
serta limit/MIME di Storage. Jangan mengunggah screenshot dengan informasi pribadi
pelanggan tanpa penyamaran/izin. Tidak ada sanitasi isi gambar otomatis.

Pengurutan memakai satu RPC transaksional dan menolak daftar ID yang sudah berubah.
Penghapusan menyembunyikan baris dahulu, menghapus file, lalu metadata. Jika salah
satu langkah gagal, pesan memberi instruksi mencoba penghapusan kembali; Storage
 dan database bukan satu transaksi. Kegagalan pencatatan upload mencoba membersihkan
file hanya setelah memastikan baris belum tersimpan.

Tidak perlu service-role key, bucket publik, proyek baru, Docker, atau deploy.


## Hasil review keamanan lokal

Definisi helper diperiksa dari `products-crud-schema-inspection.json`: SQL STABLE
SECURITY DEFINER, owner postgres, search_path kosong, hanya EXISTS admin_users
berdasarkan auth.uid(). Snapshot juga menolak seluruh write anon/authenticated
ke admin_users. Ini bukti konfigurasi tersimpan, bukan bukti keadaan produksi saat ini.
SQL sekarang memeriksa baseline fungsi, hak helper/client dan RLS Storage sebelum DDL.
Jika berbeda, transaksi berhenti untuk review, tanpa mengganti helper atau grants existing.

Policy Storage permisif lama bisa memberi akses lewat OR. Guard AS RESTRICTIVE yang
baru membatasi SELECT/INSERT/UPDATE/DELETE pada bucket testimonials, termasuk melarang
UPDATE/overwrite/move masuk atau keluar bucket. Untuk bucket lain guard bernilai TRUE.
Policy lama tidak diedit/dihapus dan definisinya dibandingkan sebelum/sesudah transaksi.
Policy restriktif lama masih dapat menolak akses sah: periksa hasil verifier bila upload,
signed URL atau delete ditolak; jangan menghapus policy lama otomatis.

Jalur dependensi baru tidak rekursif: Storage SELECT -> testimonials SELECT ->
is_admin -> admin_users. Policy testimonials tidak membaca Storage; helper tidak
membaca testimonials atau Storage. Perubahan helper/policy existing di produksi tetap
perlu diverifikasi. Tidak ada perubahan pada produk/paket, policy Auth, atau helper.

Frontend tidak memakai getPublicUrl atau URL publik. image_url adalah referensi storage://,
bukan URL gambar yang dapat diakses. createSignedUrls memakai sesi pemanggil serta RLS
SELECT, lalu img memakai signed URL. TTL lima menit mengurangi jendela akses setelah
unpublish; URL yang sudah diterbitkan tetap berlaku sampai expiry. Pembaca publik dapat
menyalin gambar yang memang dipublikasikan. Pencabutan publikasi bukan penarikan salinan.

Sebelum eksekusi, jalankan hanya `verify-testimonials-security.sql` secara manual dan
cocokkan helper/keanggotaan/RLS dengan baseline. File tersebut SELECT dalam READ ONLY.
Sesudah setup, uji identitas terpisah melalui Data API/Storage API:
- Pengunjung anon dan pengguna login non-Admin: hanya metadata dan signed URL gambar
  published yang berhasil; draft dan INSERT/UPDATE/DELETE/reorder ditolak.
- Admin: upload draft, baca preview, publish, reorder dan hapus satu screenshot uji.
- Signed URL baru untuk draft ditolak; setelah unpublish, URL baru ditolak, sedangkan
  URL lama memiliki jendela TTL. File hilang harus menghasilkan error yang jelas.
- URL public dari bucket privat tidak boleh memberikan gambar.

Pengujian SQL/RLS serta Storage API ini belum dilakukan. Tes lokal hanya menguji
validasi/frontend dan struktur SQL; tidak menggantikan PostgreSQL/API nyata.
Referensi: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
https://supabase.com/docs/guides/storage/buckets/fundamentals
https://supabase.com/docs/guides/storage/security/access-control

## Review izin lock dan kompatibilitas operasi

PostgreSQL 17 mengizinkan SHARE ROW EXCLUSIVE dengan privilege tabel UPDATE atau
DELETE; kedua privilege sudah diberikan oleh setup. SECURITY INVOKER dipertahankan,
 tanpa penambahan MAINTAIN/TRUNCATE/ownership. Validasi is_admin dilakukan sebelum
lock; SELECT/UPDATE tetap tunduk RLS. Function lock_timeout=5s mencegah tunggu tanpa
batas. Jumlah UPDATE harus sama dengan jumlah ID, jika tidak seluruh RPC gagal.
Pengurutan simultan masih last-writer-wins jika daftar ID sama; daftar yang berubah
karena tambah/hapus ditolak. Tidak ada optimistic revision untuk urutan testimoni.

Pemetaan operasi terhadap policy:
- Upload upsert=false: INSERT Storage, lalu INSERT metadata draft; diizinkan Admin.
- Preview draft: SELECT metadata dan SELECT Storage; diizinkan Admin.
- Publikasi: UPDATE metadata saja; tidak memerlukan UPDATE Storage.
- Hapus: UPDATE metadata menjadi draft, SELECT/DELETE Storage (Admin tetap dapat
  membaca draft), lalu DELETE metadata. Jika file sudah hilang, daftar Admin tetap
  menampilkan metadata agar pembersihan dapat dicoba ulang.
- Urutan: EXECUTE RPC, lock tabel, SELECT dan UPDATE metadata. Tidak menyentuh Storage.
- Non-Admin ditolak oleh is_admin/RLS. Guard UPDATE Storage memang menolak overwrite;
  itu sesuai upload tanpa upsert dan publikasi yang hanya mengubah metadata.

Uji langsung sesudah setup diperlukan: RPC sebagai Admin memakai JWT authenticated,
penolakan JWT non-Admin, dua sesi reorder, lock timeout dengan writer lain, dan retry
hapus ketika file sudah hilang. Verifier hanya memeriksa grants/metadata, bukan
membuktikan eksekusi lock dengan identitas Admin.
Sumber izin: https://www.postgresql.org/docs/17/sql-lock.html
