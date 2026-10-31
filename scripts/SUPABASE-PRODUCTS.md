# Pembacaan produk Supabase — belum diaktifkan pada halaman

Schema diaudit dari scripts/supabase-schema.json dan dikonfirmasi melalui SELECT
kolom aktual sebagai anon. id/name/description/category/icon/color/badge/image_url
bertipe text; plans JSONB berisi array duration string dan price number. Timestamp
database tidak diperlukan untuk model katalog sehingga tidak diambil.

src/lib/supabase/products.ts menyediakan:
- mapSupabaseProducts(unknown): validasi boundary dan mapping image_url ke imageUrl.
- fetchSupabaseProducts(client): hanya SELECT public.products memakai client SSR
  browser/server yang diberikan. Tidak menulis, melakukan fallback, atau menyimpan data.

src/lib/supabase/products.server.ts menyediakan getSupabaseProducts(), pembungkus
server-only yang membuat client server existing per request. Untuk browser nanti,
panggil fetchSupabaseProducts(createClient()) dari client.ts pada alur yang disetujui.
Reader kini dipakai hanya oleh hook preview development pada URL eksplisit
?source=supabase-preview. Hook lokal dan halaman Admin tetap tidak berubah.

Semua nilai teks dipertahankan tanpa trim; trim hanya untuk validasi id/nama/durasi.
Harga wajib integer aman nonnegatif. Paket kosong/malformed, tipe salah, ID duplikat
dan error API ditolak. URL gambar kosong tetap kosong; fallback gambar tetap menjadi
tanggung jawab komponen ProductImage existing. Input dan array paket tidak dimutasi.
Data kosong menghasilkan [], tidak otomatis diganti produk contoh. Reader tidak
membatasi jumlah produk menjadi 7; angka 7/14 hanya assertion dataset uji saat ini.

Pengujian tanpa jaringan:
```
node scripts/test-supabase-products.cjs
npm.cmd run typecheck
npm.cmd run build
```

Pengujian opsional SELECT anon terhadap proyek yang dikonfigurasi:
```
node --env-file=.env.local scripts/test-supabase-products.cjs --live
```
Uji live membandingkan seluruh field dari Supabase dengan backup aktual, mengabaikan
urutan baris produk untuk perbandingan, tetapi mempertahankan urutan paket. Tidak
menampilkan kredensial/isi produk/WhatsApp, tidak melakukan login atau operasi tulis.

Catatan integrasi berikutnya:
- Reader mengurutkan id agar hasil deterministik, bukan meniru urutan localStorage.
  Sebelum aktivasi, sepakati mapping urutan tampilan agar katalog tidak bergeser.
- SELECT saat ini satu request; jika katalog melampaui batas baris PostgREST,
  tambahkan pagination sebelum penggunaan pada dataset besar.
- Supabase belum menjadi sumber utama dan pengaturan WhatsApp masih memakai alur
  lokal. Jangan aktifkan reader atau sinkronisasi lokal-ke-database secara otomatis.
- Tahap berikutnya: pembacaan pembanding yang tidak mengubah UI, penanganan error/
  loading, urutan tampilan, lalu persetujuan perpindahan sumber secara eksplisit.
