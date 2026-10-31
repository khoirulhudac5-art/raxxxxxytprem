# Login Admin — produk tetap localStorage

## Alur

- /admin adalah Server Component dinamis. auth.getUser() memverifikasi identitas
  melalui Auth server; tidak mempercayai getSession() atau cookie tanpa verifikasi.
- Setelah identitas valid, RPC is_admin() harus mengembalikan boolean true persis.
  Fungsi existing memeriksa auth.uid() terhadap admin_users. Tidak ada SELECT langsung
  admin_users, key istimewa, perubahan membership, atau email allowlist di frontend.
- Tanpa sesi diarahkan ke /admin/login. Non-Admin mendapat Akses ditolak tanpa UI
  workspace. Kegagalan konfigurasi/jaringan/RPC menolak akses sementara.
- Email/password dikirim lewat POST ke /admin/login/submit dan diproses oleh server
  menggunakan signInWithPassword. Tidak dicatat ke log, URL, atau localStorage.
- Logout adalah POST /admin/logout dengan signOut scope local; tidak keluar dari
  semua perangkat. Jika gagal, tampilkan status gagal, bukan klaim logout sukses.
- Route POST menolak Origin yang hilang/berbeda. Redirect tujuan tetap, tanpa
  parameter next dari pengguna. Reverse proxy mendatang harus meneruskan origin
  secara konsisten; jangan menonaktifkan validasi bila konfigurasi origin salah.
- middleware.ts (Next.js 15) hanya mencakup /admin/:path*. Ia menyegarkan cookie
  menggunakan getClaims dan meneruskan cookies/cache headers SDK ke response.
  Pemeriksaan halaman tetap dilakukan terpisah dengan getUser dan is_admin.
- Cookie sesi memakai @supabase/ssr. Response Admin/Auth diberi private, no-store;
  tidak memakai cache bersama untuk halaman yang membutuhkan autentikasi.

## Yang tetap sama

AdminWorkspace adalah UI/form Admin lama yang dipindah ke komponen client, ditambah
tombol Logout dan pembaruan keterangan login. Produk, edit/hapus, backup JSON, preview
gambar, serta pengaturan WhatsApp tetap memakai localStorage existing. Tidak ada
INSERT/UPDATE/DELETE produk/pengaturan Supabase. Jangan menganggap autentikasi halaman
menjadikan localStorage sumber bersama atau penyimpanan yang tidak bisa dimanipulasi.
Katalog publik tidak diubah. Tidak ada akun, grants, RLS, provider, atau default
privileges yang dibuat/diubah oleh implementasi ini. Login/logout mengelola sesi Auth
normal; konfigurasi Auth tetap sama.

## Pengujian manual

1. Pastikan .env.local berisi URL dan publishable key existing. Jangan kirim password
   atau token melalui chat. Jalankan npm.cmd run dev; jangan bersamaan dengan build.
2. Incognito tanpa sesi: buka /admin, harus menuju /admin/login tanpa form produk.
3. Masukkan kredensial salah secara manual: pesan generik, password tidak diulang
   dalam HTML/URL. Jangan mengulang banyak percobaan karena ada rate limit Supabase.
4. Login dengan akun Admin existing yang sudah terkonfirmasi: diarahkan ke /admin.
   Seluruh workspace/form lama muncul; tidak perlu menyimpan/menghapus produk untuk
   menguji Auth. Akun harus lolos is_admin(), bukan sekadar berhasil login.
5. Reload /admin untuk memeriksa sesi. Uji refresh sesi pada waktu token diperbarui.
6. Klik Logout, harus kembali ke login. Buka ulang /admin, harus ditolak/redirect.
   Periksa localStorage sebelum/sesudah: tidak boleh berubah karena login/logout.
7. Jika akun non-Admin existing tersedia, login dengan akun itu dan pastikan pesan
   Akses ditolak muncul tanpa workspace, termasuk lewat URL /admin langsung. Jangan
   membuat akun baru atau mengubah admin_users untuk pengujian produksi.
8. Simulasikan jaringan Supabase gagal: workspace tidak boleh ditampilkan kepada
   sesi yang belum lolos verifikasi. Pulihkan koneksi dan coba lagi.
9. Buka katalog normal/preview development; sumber dan tampilannya tetap sama.

## Validasi lokal dan keterbatasan

```
node scripts/test-admin-auth.cjs
npm.cmd run typecheck
npm.cmd run build
```

Tes mock mencakup sesi kosong/invalid, identity verified, true/false/non-boolean RPC,
error Auth/RPC/config, Origin, redirect, cookie login/logout, dan middleware setAll
berulang berikut cache headers. Tidak menggunakan akun/password nyata atau jaringan.
HTTP tanpa sesi dapat diuji lokal tanpa melakukan login. Pengujian login Admin nyata,
non-Admin nyata, refresh token, dan browser end-to-end masih perlu manual.
Jangan menguji DML atau membuat akun/data produksi sebagai bagian uji login ini.

Rate limiting login mengikuti Supabase Auth existing; belum ada limiter aplikasi
tambahan. Untuk deployment kelak wajib HTTPS dan pemeriksaan konfigurasi proxy/cache.
Sesi yang sudah memuat workspace di browser tidak mengunci localStorage ketika token
kedaluwarsa; akses server berikutnya kembali diverifikasi. Ini bukan integrasi CRUD
database dan bukan alasan mengendurkan RLS saat tahap CRUD dikerjakan nanti.
