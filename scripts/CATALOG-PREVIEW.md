# Urutan dan status katalog (preview development saja)

## Temuan urutan

useProducts membaca array localStorage tanpa sort. page.tsx hanya memfilter array,
sehingga urutan yang ditampilkan mengikuti urutan tersimpan. Tambah produk oleh Admin
menambahkan ke akhir; edit mempertahankan posisi; hapus membuang posisi terkait.

Backup aktual saat migrasi: chatgpt, capcut, canva, google, youtube, spotify, zoom.
Reader Supabase (dikonfirmasi SELECT anon): canva, capcut, chatgpt, google, spotify,
youtube, zoom. Seluruh nilai produk/paket sama; urutan mentahnya berbeda.

Isi localStorage browser yang sedang aktif tidak diakses dari proses Node. Backup
adalah referensi yang sudah diverifikasi, bukan bukti bahwa browser belum berubah.
Saat integrasi disetujui, gunakan readStoredCatalog(window.localStorage, STORAGE_KEY)
untuk memperoleh array aktual secara read-only, lalu compareCatalogs(local,remote).
Jika storage hilang/rusak/tidak dapat diakses, helper melempar error dan tidak
mengganti dengan data contoh. Array kosong yang tersimpan tetap dianggap array kosong.

## Mekanisme terpisah dari halaman

- catalog.ts: migratedCatalogOrder berisi ID dari backup aktual; bukan data contoh.
- orderCatalog(remote, referenceIds) mengurutkan menurut referensi, tanpa sort ID.
  Referensi aktual browser dapat diberikan untuk menggantikan baseline backup.
  Produk baru di luar referensi ditempatkan terakhir sesuai urutan masuk; produk
  hilang tidak diciptakan ulang. Input tidak dimutasi. ID referensi duplikat ditolak.
- compareCatalogs membedakan perubahan isi dan urutan, melaporkan ID hilang/baru/
  berubah, termasuk perubahan harga dan urutan paket.
- useCatalogPreview default enabled=false. Katalog mengaktifkannya hanya pada URL
  development eksplisit; Admin tidak menggunakannya.
  Jika kelak dipanggil enabled=true, urutan referensi dapat disuplai. Status memuat
  dipisahkan; retry memulai request baru dan hasil request lama diabaikan.
- Tidak ada sinkronisasi, seed, penulisan localStorage, atau perubahan database.

## Status

| Status | Arti |
| --- | --- |
| idle | Preview belum diaktifkan; tidak membuat client/request |
| loading | Request sedang menunggu hasil |
| ready | Request berhasil dan produk terpetakan tersedia |
| empty | Request berhasil, tetapi tidak ada baris yang terlihat oleh role pemanggil |
| error | Request/konfigurasi/mapping gagal; bukan katalog kosong |

empty memiliki scope visible_rows. SELECT anon tidak bisa membedakan tabel fisik
kosong dari tabel yang semua barisnya disaring RLS. Untuk menyatakan database
benar-benar kosong diperlukan pemeriksaan terpisah oleh pihak berwenang; jangan
memberikan key istimewa ke frontend demi pemeriksaan itu. Error tidak menambahkan
  produk contoh dan tidak menghapus data lokal. UI status hanya muncul pada preview.

## Verifikasi

```
node scripts/test-catalog-preview.cjs
node scripts/test-supabase-products.cjs
npm.cmd run typecheck
npm.cmd run build
```

Opsional, hanya SELECT sebagai anon:
```
node --env-file=.env.local scripts/test-catalog-preview.cjs --live
```

Pengujian mencakup kesetaraan 7 produk/14 paket setelah pengurutan, urutan custom
yang mensimulasikan localStorage terbaru, ID tambahan/hilang, perubahan nilai,
non-mutasi, storage rusak, status kosong/error, disabled tanpa request, loading,
ready, dan respons terlambat yang diabaikan. Siklus hook diuji dengan mock React;
belum berupa pengujian browser end-to-end karena hook belum dihubungkan ke UI.

Langkah berikutnya menunggu persetujuan: bandingkan array browser aktual dengan
Supabase, tetapkan referensi urutan yang dipakai bersama semua perangkat (snapshot
yang disetujui, dan mekanisme urutan persisten pada tahap lain jika diperlukan),
lalu rencanakan aktivasi sumber dan UI status. Jangan memakai urutan browser masing-
masing sebagai standar global tanpa menyepakatinya. Supabase belum sumber utama.

## Preview development melalui browser

Jalankan npm.cmd run dev setelah .env.local terisi. Jangan menjalankan next dev dan
next build bersamaan karena keduanya menggunakan .next. Gunakan port yang tercetak
di terminal (contoh port default berikut).

- Normal: http://localhost:3000/ — produk dan WhatsApp memakai alur lokal existing.
- Preview: http://localhost:3000/?source=supabase-preview — produk dari Supabase,
  WhatsApp masih dari pengaturan lokal existing. Badge teks development menandai
  sumber agar pengujian tidak tertukar; desain kartu tetap sama.
- Production (npm.cmd run build lalu npm.cmd start): parameter tersebut diabaikan,
  sehingga kedua URL tetap menggunakan katalog lokal. Tidak ada query preview.

Preview kini memakai adapter bersama dan referensi urutan migrasi yang disetujui,
tanpa menunggu/menggunakan isi localStorage sebagai sumber atau standar urutan.
Mode normal tidak berubah. Lihat SHARED-PRODUCT-SOURCE.md untuk mekanisme terbaru.

Bandingkan urutan, 7 kartu, 14 opsi paket, pencarian, kategori, gambar/fallback dan
tautan WhatsApp pada kedua URL. Tidak perlu mengirim pesan WhatsApp untuk memeriksa
tujuan/teks tautan. Preview tidak memigrasikan pengaturan WhatsApp.

Untuk simulasi koneksi gagal, blokir request ke domain proyek Supabase melalui
DevTools Request Blocking, lalu buka ulang URL preview. Pesan gagal dan Coba lagi
harus terlihat tanpa kartu lokal. Hapus blocking dan klik Coba lagi untuk pulih.
Jangan menghapus produk database untuk menguji empty: keadaan itu diuji dengan mock.

```
node scripts/test-preview-mode.cjs
node scripts/test-catalog-preview.cjs
npm.cmd run typecheck
npm.cmd run build
```

test-preview-mode memeriksa gate environment/parameter, markup kartu identik,
7 produk/14 paket, loading, empty, error, dan tombol retry dengan render/mock.
Host browser otomatis tidak tersedia pada sesi implementasi; interaksi browser
end-to-end masih perlu diuji manual melalui URL di atas. Tidak ada deploy.
