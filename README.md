# Rakyat Premium

Status integrasi saat ini: katalog publik membaca produk dan pengaturan WhatsApp
dari Supabase. Migrasi metadata produksi sudah berhasil menurut hasil pengguna;
CRUD Admin telah diaktifkan di konfigurasi lokal dan tetap memerlukan login/RLS.
Uji tulis produksi satu produk menunggu persetujuan pengujian. Panduan aktivasi, pengujian,
dan deploy: [DEPLOY-VERCEL.md](scripts/DEPLOY-VERCEL.md).

Katalog digital responsif dengan Next.js App Router, TypeScript, Tailwind CSS 4, Poppins (font lokal), dan ikon Lucide. Seluruh harga awal merupakan **harga contoh**, bukan harga resmi penyedia layanan. Deskripsi bukan jaminan fitur atau ketersediaan paket.

## Menjalankan lokal

Pasang Node.js 22 LTS atau lebih baru beserta npm, lalu buka terminal di folder `rakyatKATALOG`:

```sh
npm install
npm run dev
```

Buka http://localhost:3000 untuk katalog dan http://localhost:3000/admin untuk admin.

```sh
npm run typecheck
npm run build
npm start
```

`npm start` menjalankan hasil build produksi. Jika Node/npm portabel tersedia dalam `.tools`, gunakan PowerShell:

```powershell
$env:Path = "$PWD\.tools;$env:Path"
.\.tools\node.exe .\.tools\package\bin\npm-cli.js run dev
```

## Konfigurasi toko

- Ubah `whatsappNumber` di `src/lib/config.ts` menjadi nomor internasional hanya angka, misalnya format `628xxxxxxxxxx`. Default kosong agar tidak mengirim ke nomor yang tidak dikenal. Tombol Pesan aktif setelah nomor valid diisi.
- Data contoh, kategori, harga rupiah, dan durasi awal ada di `src/lib/products.ts`.
- Ikon adalah ilustrasi kategori, bukan logo resmi merek. Tampilan ada di `src/app/globals.css`.
- Pilih durasi pada kartu, lalu klik Pesan untuk membuka WhatsApp dengan nama produk, durasi, dan harga contoh. Pembeli tetap harus mengirim pesannya sendiri.

## Catatan prototipe lama (sebelum integrasi Supabase)

Halaman `/admin` dapat menambah, mengedit, dan menghapus produk, termasuk deskripsi, kategori, ikon, label, warna, dan beberapa pilihan durasi/harga. Penghapusan memerlukan konfirmasi. Data disimpan dengan key `rakyat-premium-products-v1` pada localStorage. Katalog membaca data yang sama; tab pada origin yang sama ikut diperbarui melalui storage event.

**Tidak ada login atau perlindungan admin.** localStorage hanya berada di browser/profil dan origin yang sama (protokol, host, port). Data tidak tersinkron ke perangkat atau pengguna lain dan dapat hilang jika penyimpanan browser dibersihkan. Data dapat dimanipulasi melalui browser. Ini belum cocok untuk admin online bersama atau penyimpanan permanen lintas perangkat. Sebelum penggunaan produksi, tambahkan database, autentikasi, otorisasi dan validasi di server.

Data contoh digunakan saat belum ada data tersimpan. Untuk kembali ke data awal, hapus key localStorage tersebut melalui DevTools browser. Mengubah file data awal tidak menimpa perubahan yang sudah disimpan di browser. Jika penyimpanan ditolak/penuh, admin menampilkan pesan kegagalan dan tidak mengklaim penyimpanan berhasil.

Proyek ini dikerjakan lokal, tanpa deployment, publikasi, atau push GitHub.

## Source GitHub dan Vercel

`package.json` berada di root repository. Gunakan branch `main`, framework Next.js,
Root Directory root repository (kosong/default), Install `npm ci`, Build `npm run build`.
Isi environment Vercel melalui dashboard, bukan file yang di-commit:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_PRODUCT_CRUD_ENABLED`, dan `SUPABASE_PRODUCT_CRUD_APPROVED_URL`.
Gunakan nilai proyek existing yang sudah disetujui. Jangan masukkan service-role key.
Perubahan environment NEXT_PUBLIC memerlukan build ulang.

`.env.local`, backup database, laporan inspeksi produksi, `.tools`, `node_modules`,
dan `.next` bukan bagian source deployment. `.env.example` hanya berisi placeholder.
SQL di scripts adalah instruksi manual; deployment tidak menjalankan migrasi database.
