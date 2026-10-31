# Infrastruktur koneksi Supabase

Browser: import createClient dari @/lib/supabase/client.
Server Components/Route Handlers: import createClient dari @/lib/supabase/server,
lalu await createClient(). Server selalu membuat client baru per request.

Salin .env.example ke .env.local, isi URL proyek dan publishable key sb_publishable_,
lalu restart npm.cmd run dev. .gitignore sudah mengabaikan .env* dan hanya
mengecualikan .env.example. Jangan memasukkan secret/service-role key.

Client sekarang digunakan oleh login/proteksi server Admin dan preview katalog development.
Produk dan pengaturan katalog/Admin tetap memakai localStorage sebagai sumber utama.
Middleware hanya aktif untuk /admin/:path*. Lihat ADMIN-AUTH.md untuk alur sesi. Konfigurasi dibaca saat factory dipanggil, bukan
saat modul diimpor, sehingga build halaman lama tidak memerlukan environment ini.

## Uji read-only manual tanpa menambah endpoint

Jalankan cuplikan berikut di PowerShell dari akar proyek setelah .env.local terisi.
Node yang tersedia mendukung --env-file. Perintah menggunakan SDK existing,
tidak menjalankan login atau membaca/mengubah localStorage/cookie browser.
Ini menguji URL, publishable key, REST API dan SELECT melalui RLS sebagai anon;
tidak membuktikan integrasi cookie Next.js atau hak Admin.

```powershell
@'
import { createServerClient } from '@supabase/ssr';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key?.startsWith('sb_publishable_')) {
  throw new Error('Isi URL dan publishable key yang benar.');
}
const client = createServerClient(url, key, { cookies: { getAll: () => [] } });
const result = await client.from('products').select('id', { count: 'exact', head: true });
if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else {
  console.log('SELECT berhasil. Jumlah produk:', result.count);
}
'@ | node --env-file=.env.local --input-type=module
```

Untuk data saat ini hasil yang diharapkan adalah 7. Jumlah 0 dapat berarti tabel
kosong atau RLS tidak mengizinkan baris, bukan otomatis koneksi gagal. Error akses
harus ditinjau pada grants/policies; jangan mengatasi dengan service-role key.
Tidak ada uji koneksi proyek nyata yang dijalankan dalam tahap persiapan ini.

## Penggunaan server client untuk Auth

Factory tanpa response membaca cookie pada Server Components. Middleware Next.js 15
sekarang menyegarkan sesi untuk /admin sebelum halaman dirender. Login/logout memakai
Route Handlers yang meneruskan NextResponse ke createClient dan mengembalikan response
itu juga, sehingga cookies serta cache headers SDK tidak hilang. Server Actions belum
memiliki adapter penulisan cookie; jangan menggunakannya untuk login tanpa penyesuaian.
Halaman Admin memverifikasi getUser() dan is_admin() di server; lihat ADMIN-AUTH.md.
