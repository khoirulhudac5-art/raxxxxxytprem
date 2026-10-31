# CRUD produk server: nonaktif secara default

Tidak ada migrasi atau penulisan Supabase yang dijalankan dalam implementasi ini.
Tidak ada perubahan environment, sumber katalog publik, data lokal, atau dependensi.

## Mode

- /admin: tetap localStorage dan Auth server existing.
- /admin?source=supabase-preview: tetap read-only preview existing.
- /admin?source=supabase-crud: mode uji writer hanya jika server mengizinkan flag.
  Tanpa flag, halaman tetap Admin lokal; jangan menyimpulkan URL saja mengaktifkannya.
- POST /admin/api/products: flag nonaktif memberi 404 sebelum client Supabase dibuat.
  Request tidak mengunggah localStorage; writer hanya menyimpan satu produk pilihan.

Gate server memerlukan NODE_ENV=development, SUPABASE_PRODUCT_CRUD_ENABLED=true dan
SUPABASE_PRODUCT_CRUD_TEST_URL sama persis dengan NEXT_PUBLIC_SUPABASE_URL.
Tidak ada variabel ini ditambahkan ke .env.local. Production build selalu menolak
CRUD meskipun flag true. TEST_URL hanya guard target eksplisit, bukan bukti database
terisolasi: jangan mengisinya dengan URL produksi sekarang. Aktivasi produksi kelak
memerlukan review kode/approval terpisah. Tidak perlu membuat proyek Supabase baru.

## Perlindungan

Setiap list/create/update/delete melalui endpoint POST JSON, Origin harus sama,
getUser + is_admin strict true di server, cookie client SSR + publishable key, RLS
existing tetap berlaku. Error Auth/RPC menolak akses. Body maksimal 32 KiB termasuk
stream tanpa Content-Length. Payload whitelist, batas panjang, paket 1..50, harga
integer 0..999999999999, URL PNG/JPG/JPEG/WebP HTTP(S), ikon/warna whitelist.
Tidak menerima created_at/updated_at/revision/sort_order dari payload produk.

Reader khusus CRUD meminta revision/sort_order sebelum writer: kolom belum tersedia
menghasilkan 503 tanpa INSERT/UPDATE/DELETE. Reader preview existing tidak diganti.
Schema dan trigger migrasi tetap harus diverifikasi manual sebelum opt-in: keberadaan
kolom saja tidak membuktikan trigger terpasang/benar. Endpoint bukan migrator schema.

Tambah UUID stabil per draft; retry memakai ID sama dan duplicate key menjadi 409,
bukan upsert/overwrite. Posisi max+10; penambahan paralel dapat bernilai sama dengan
tie-break id yang deterministik. Belum menyediakan reorder UI/multi-row transaction.
UPDATE/DELETE memakai .eq(id).eq(revision) dalam satu statement dan RETURNING.
Stale/missing/denied menghasilkan 409 tanpa retry menimpa otomatis. Trigger database
meningkatkan revision. Kontrak ini melindungi handler aplikasi, bukan membatasi semua
UPDATE langsung oleh Admin yang punya grants existing. RLS tetap pembatas identitas.

UI mempertahankan draft/revision yang dibaca saat editor dibuka; refresh tidak
mengganti revision draft diam-diam. Gagal tulis tidak menutup draft/modal; sukses
ditampilkan setelah DB mengonfirmasi. Satu operasi berjalan per tab, mutasi tidak
optimistis. Setelah sukses, invalidasi preview dan baca ulang DB. Bila refresh gagal,
error tetap tampil; sukses tulis dan gagal baca ulang adalah dua kondisi berbeda.
Timeout ambigu: muat ulang dan periksa sebelum retry. Jangan mengambil revisi baru
otomatis untuk menyimpan draft lama. BroadcastChannel tidak menyinkronkan perangkat
lain secara langsung. Katalog normal belum memakai Supabase.

WhatsApp tetap lokal. Backup lokal disembunyikan dalam mode uji CRUD agar tidak
disalahartikan sebagai backup DB; endpoint ekspor Supabase existing tetap tersedia.
Backup metadata sort_order/revision belum diselesaikan: jangan aktifkan writer
terhadap produksi sebelum exporter/restore dan migrasi ditinjau.

## Pengujian yang aman saat ini

    node scripts/test-product-crud.cjs
    node scripts/test-admin-auth.cjs
    node scripts/test-admin-preview.cjs
    npm.cmd run typecheck
    npm.cmd run build

Semua tes CRUD memakai memory mock, tidak membaca environment atau terhubung database.
Race mock membuktikan kondisi revision dikirim dan stale hasil ditolak; tidak
membuktikan locking PostgreSQL nyata. Uji paralel database tetap diperlukan setelah
persetujuan pada lingkungan uji yang disetujui, tanpa membuat proyek baru otomatis.

## Langkah berikutnya

1. Tetap biarkan flag nonaktif. Tinjau implementasi, hasil build dan rencana schema.
2. Tentukan lingkungan database uji yang diizinkan (misalnya PostgreSQL/Supabase lokal
   terisolasi, instalasi memerlukan persetujuan terpisah). Jangan menunjuk ke produksi.
3. Setelah persetujuan, siapkan schema/RLS/Auth uji dan rehearsal migrasi ROLLBACK,
   snapshot ACL dan validasi 7/14. Jangan mengubah akhir skrip sekarang.
4. Setelah schema persisten uji dan Auth disetujui, aktifkan dua opt-in hanya untuk
   target uji, restart dev, buka /admin?source=supabase-crud. Login pemilik secara manual.
5. Uji create/edit/delete produk uji, dua sesi stale edit/delete, retry UUID sama,
   non-Admin/anon, error koneksi, refresh dan backup/restore. Normal/preview harus tetap
   berfungsi. Nonaktifkan flag setelah selesai.
6. Produksi memerlukan persetujuan migrasi, backup metadata baru, pemulihan tervalidasi,
   serta aktivasi writer dan cutover katalog terpisah. Tidak ada langkah deploy saat ini.
