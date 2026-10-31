# Preview Supabase Admin — read-only produk

Normal: http://localhost:3000/admin
Preview: http://localhost:3000/admin?source=supabase-preview

Kedua URL memakai pemeriksaan server yang sama: getUser() lalu is_admin() harus true.
Tanpa sesi diarahkan ke login; non-Admin ditolak; error pemeriksaan gagal tertutup.
Parameter preview baru diproses setelah akses server lulus. Preview Admin tidak
dibatasi NODE_ENV, berbeda dari preview katalog publik, tetapi selalu memerlukan Admin.
Jika diarahkan ke login, setelah berhasil masuk buka lagi URL preview di atas.

Preview menggunakan useCatalogPreview/fetchSupabaseProducts/mapSupabaseProducts
existing, bukan sistem query baru. Urutan mengikuti referensi bersama dari backup migrasi yang disetujui,
tidak lagi bergantung pada array lokal masing-masing perangkat. Tidak ada fallback isi
produk lokal/contoh. Status idle/loading, error, empty, retry memakai tampilan existing.
Daftar Admin menampilkan paket/harga yang sama dan indikator jumlah produk/paket.
Mode normal tetap menggunakan useProducts dan perilaku localStorage existing.

Operasi produk read-only dijaga pada tiga lapisan:
- Kontrol tambah/edit/hapus dinonaktifkan.
- Handler setDraft/setDeleting, submit, save dan konfirmasi delete menolak preview.
- Form editor/paket dan dialog hapus tidak dirender pada preview, termasuk bila ada
  draft tersisa. Workspace diremount saat mode berganti untuk membuang draft lama.

Tidak ada fitur impor pada Admin saat ini. Export Backup lokal tidak ditampilkan di
preview supaya tidak disangka mengekspor data Supabase. Tidak ada endpoint tulis
produk Supabase. Handler paket mengubah draft melalui setter yang juga dijaga.
Pengaturan WhatsApp tetap localStorage dan boleh disimpan melalui panel existing;
indikator read-only berlaku untuk produk/paket, bukan login/logout atau WhatsApp.

Uji manual setelah login dengan akun Admin existing:
1. Buka /admin normal: form lokal dan backup masih tersedia. Jangan menyimpan jika
   hanya memeriksa tampilan; data lokal tidak perlu diubah untuk uji preview.
2. Buka URL preview. Pastikan label PREVIEW SUPABASE · READ-ONLY, 7 produk/14 paket,
   urutan sesuai katalog lokal, dan seluruh kontrol produk disabled.
3. Pastikan tidak ada editor paket atau konfirmasi hapus yang dapat dibuka.
4. Blokir domain proyek Supabase di DevTools Request Blocking, lalu reload preview:
   error harus jelas tanpa daftar lokal/contoh. Buka blocking lalu klik Coba lagi.
5. Empty diuji melalui mock, jangan menghapus data database untuk menyimulasikannya.
6. Tanpa sesi: URL preview mengarah ke login. Akun non-Admin existing harus mendapat
   Akses ditolak; jangan membuat akun baru atau mengubah admin_users demi pengujian.
7. Beralih kembali ke /admin: sumber lokal tidak berubah. Katalog publik tidak diubah.

Validasi:
```
node scripts/test-admin-preview.cjs
node scripts/test-admin-auth.cjs
node scripts/test-catalog-preview.cjs
npm.cmd run typecheck
npm.cmd run build
```
Tes preview memanggil handler tombol disabled secara paksa dan memastikan writer
lokal tidak dipanggil, memeriksa form tersembunyi, status/retry, mode normal, serta
guard server untuk anonymous/non-Admin/error. Ini mock/render, bukan uji browser
bersesi Admin nyata. HTTP tanpa sesi dapat diperiksa terpisah tanpa kredensial.
Reader diuji SELECT anon terhadap 7 produk/14 paket; sesi Admin nyata diuji manual.

Jangan menjalankan build bersamaan dengan dev. Supabase belum sumber utama Admin,
tidak ada migrasi ulang, DML, perubahan schema/RLS/Auth/grants/dependensi atau deploy.
Default privileges masih menjadi pekerjaan keamanan terpisah. Jika sesi dicabut saat
halaman sudah terbuka, akses server berikutnya diperiksa ulang; preview tidak memberi
hak istimewa pada data produk yang memang dapat dibaca publik melalui RLS.
