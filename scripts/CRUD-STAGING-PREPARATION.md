# Persiapan CRUD: belum disetujui untuk eksekusi

## Pembaruan setelah laporan schema terbaru

products-crud-schema-inspection.json berformat rakyat-crud-schema-inspection-v1,
captured_at 2026-10-30T18:49:26.386107+00:00, PostgreSQL 17.11, mengonfirmasi
7 produk/14 paket, satu store_settings, schema existing sesuai rancangan, tidak ada
trigger produk, RLS aktif dan effective grants sesuai target. Dua trigger internal
foreign key admin_users tetap dipertahankan. Ini menggantikan keterbatasan informasi
schema dari upaya OpenAPI di bawah; tetap ambil snapshot terbaru sebelum eksekusi.

Migrasi sekarang membandingkan snapshot RLS/FORCE, owner, raw table/column ACL,
seluruh policies dan definisi/ACL is_admin sebelum/sesudah dalam transaksi. Pengisian
sort_order dan revision diperiksa secara tepat, termasuk jumlah 7/14. SHARE lock pada
store_settings/admin_users mencegah penulisan dan DDL terkait selama pemeriksaan;
jadwalkan rehearsal, jangan jalankan terhadap produksi sekarang. Role attributes,
membership dan default ACL tetap perlu snapshot/verifier terpisah; migrasi tidak
mengubahnya. Sebelum snapshot, grants harus sudah lulus verifier existing; pembandingan
identik tidak dengan sendirinya membuktikan baseline aman.

Verifier menghasilkan initial_crud_schema_checks serta tabel detail. Semua boolean
harus true untuk keadaan awal. initial_revision_passed akan false setelah edit CRUD
yang sah: jangan menyebutnya kegagalan migrasi jika pengujian tulis sudah dimulai.
Hasil grants/default privileges tetap terpisah dalam verify-supabase-grants.sql.
Bandingkan laporan metadata lengkap sebelum/sesudah untuk perubahan yang tidak diharapkan.

## Langkah manual pemula: jangan menulis database sekarang

1. Saat ini cukup periksa Dashboard: apakah organisasi Free mempunyai satu slot
   proyek aktif yang tersedia? Catat jawabannya, jangan membuat proyek dahulu.
2. Setelah persetujuan terpisah, buat staging manual di organisasi Free. Bila Dashboard
   meminta pembayaran, berhenti. Cocokkan reference staging berbeda dari produksi.
3. Persiapkan baseline schema/RLS/grants untuk staging dan rencana restore v2 untuk
   review. SQL baseline/restore belum disediakan; jangan menjalankan migrator lama v1.
4. Setelah baseline dan restore staging disetujui serta selesai, jalankan inspector
   JSON dan simpan hasil. Pastikan 7/14, grants/RLS benar dan backup cocok seluruh field.
5. Minta persetujuan rehearsal STAGING. Jalankan seluruh prepare-products-crud-schema.sql
   tanpa menghapus baris ROLLBACK. Simpan hasil rehearsal_checks_passed beserta 7/14,
   urutan tujuh ID dan initial_revisions_passed=true. Error apa pun berarti berhenti.
6. Setelah rehearsal berakhir, jalankan inspector lagi: dua kolom dan trigger baru
   seharusnya tidak ada karena ROLLBACK. Verifier pascamigrasi memerlukan kolom tersebut,
   jadi jangan jalankan verifier itu terhadap keadaan setelah rehearsal dibatalkan.
7. Kirim hasil rehearsal untuk review. Tidak ada instruksi commit dalam tahap ini.
   Verifier pascamigrasi digunakan hanya pada staging yang kemudian diberi persetujuan
   terpisah untuk migrasi persisten, sebelum pengujian CRUD.

## Latihan konflik dan restore staging setelah persetujuan terpisah

- Dua sesi Admin A/B membaca produk uji revision=1. A mengubah dengan WHERE revision=1
  sambil menahan transaksi; B menjalankan conditional UPDATE/DELETE yang sama. B menunggu;
  setelah A commit, B harus mendapat nol baris. Ulangi dengan A rollback: B boleh sukses.
- Jangan memakai API request terpisah untuk BEGIN/UPDATE/ROLLBACK: request pool tidak
  menjamin koneksi sama. Gunakan koneksi PostgreSQL staging independen atau harness
  transaksi staging yang ditinjau, tanpa membagikan password ke laporan. Kredensial
  uji hanya dimasukkan pemilik. Buktikan juga anon/non-Admin ditolak melalui Data API.
- Operasi ubah array plans adalah satu UPDATE dengan expected revision. Reorder banyak
  produk memerlukan transaksi/RPC khusus; belum ada implementasinya. Urutkan lock ID
  untuk mengurangi deadlock; tangani 40001/40P01 tanpa retry menimpa draft baru.
- Setelah timeout, baca ulang ID/revision dan bandingkan isi; jangan memaksa revision
  terbaru. Setelah DELETE, ID UUID lama tidak boleh digunakan untuk produk baru.
- Restore: simpan baseline JSON+ACL, validasi backup offline, dry-run per ID, lalu
  restore hanya di staging setelah konflik disetujui. Uji kembali seluruh nama,
  deskripsi/kategori, gambar, paket/harga, urutan dan WhatsApp, bukan hanya counts.
  Simulasikan error di tengah restore dan pastikan satu transaksi membatalkan semua.
- Sebelum CRUD aktif, exporter harus mendukung sort_order/revision. Format v2 lama
  belum menyimpan metadata tersebut; jangan mengklaim round-trip metadata penuh.
- Rollback schema bukan restore data. Sesudah CRUD, pertahankan kolom dan pulihkan
  aplikasi dahulu; jangan menurunkan revision atau mengunggah localStorage lama.

## Status audit 2026-10-31

Tidak ada SQL yang dijalankan. GET metadata OpenAPI /rest/v1/ menggunakan publishable
key mendapat HTTP 401; hasil ini tidak membuktikan SELECT produk gagal. Metadata
aktual lengkap (constraints, trigger, ACL, dependencies) belum dapat diverifikasi
dari API yang tersedia. Rancangan memakai scripts/supabase-schema.json, reader,
snapshot ACL dan laporan grants existing. Snapshot schema lama mencatat sebelum
migrasi data; angka nol di dalamnya bukan jumlah produk sekarang.

WAJIB jalankan inspect-products-crud-schema.sql secara manual di SQL Editor dan
simpan semua hasil sebelum menyetujui SQL final. Gunakan juga snapshot-supabase-acl.sql
dan verify-supabase-grants.sql. Cocokkan proyek melalui Dashboard Project Settings;
nama database postgres saja tidak membuktikan identitas proyek. Tidak perlu memberi
password, token, atau service-role key kepada pengembang.

## Pilihan schema

Pertahankan products dan JSONB plans (urutan array paket tetap), store_settings tidak
diubah. Tambah sort_order integer nonnegatif dan revision integer positif default 1.
Trigger BEFORE INSERT/UPDATE menormalkan revision insert=1, update=OLD+1,
updated_at=clock_timestamp(); ID update immutable. Timestamp awal tujuh produk tidak
berubah karena pemasangan trigger dilakukan sesudah pengisian urutan.

Urutan awal: chatgpt 10, capcut 20, canva 30, google 40, youtube 50, spotify 60, zoom 70.
Reader kelak ORDER BY sort_order,id, menggantikan prioritas ID hardcoded. Nilai sama
diizinkan dengan tie-break id, sehingga dua penambahan paralel tetap deterministik.
Produk baru harus diberi posisi akhir eksplisit; tidak ada default 0 yang menaruhnya
diam-diam di depan. Jika wajib urutan penambahan ketat, gunakan allocator transaksional
terpisah; belum disiapkan dalam migrasi ini. Pengurutan manual belum diaktifkan.

prepare-products-crud-schema.sql adalah rehearsal transaksional dengan ROLLBACK di
akhir. Jangan menggantinya dengan COMMIT tanpa review dan persetujuan terpisah.
Preflight menolak objek yang sudah ada, trigger tambahan, tujuh ID berbeda, atau RLS
nonaktif. Re-run sesudah commit gagal aman, bukan mengganti revision/order existing.
Snapshot temporer membuktikan seluruh field produk sebelum/sesudah tetap identik
selain dua kolom baru. ACCESS EXCLUSIVE dapat memblokir SELECT sebentar: staging
dahulu, produksi kelak butuh jendela terjadwal. Timeout lock 5 detik, statement 30 detik.

## Optimistic concurrency: kontrak operasi mendatang

Tidak ada writer atau endpoint baru pada website. Contoh berikut hanya kontrak,
bukan skrip siap dijalankan. Parameter harus terikat, tidak interpolasi teks SQL.

    UPDATE public.products
    SET name = $1, description = $2, plans = $3
    WHERE id = $4 AND revision = $5
    RETURNING id, revision, updated_at;

    DELETE FROM public.products
    WHERE id = $1 AND revision = $2
    RETURNING id;

UPDATE dan pemeriksaan revisi dilakukan dalam SATU statement, bukan SELECT lalu
UPDATE tanpa kondisi. PostgreSQL mengunci baris dan memeriksa ulang kondisi setelah
menunggu writer lain pada READ COMMITTED. Hanya satu operasi dengan revision lama
berhasil. Tangani serialization/deadlock jika isolation berbeda; jangan retry dengan
revision terbaru secara otomatis. Zero affected rows bukan sukses: baca ulang melalui
sesi yang sama untuk membedakan hilang, konflik, atau akses ditolak; pertahankan draft.

Next.js server memverifikasi getUser + is_admin setiap mutation, Origin untuk POST,
validasi allowlist seluruh field, maksimal panjang/ukuran payload dan paket, harga
integer aman nonnegatif, durasi nonkosong, URL HTTP(S) gambar valid. Pakai sesi Admin
dan publishable key dengan RLS, tidak service-role. Trigger bukan pengganti validasi.
Validasi bentuk JSONB juga perlu CHECK database yang dirancang setelah audit data
aktual; migrasi ini belum menambah aturan bisnis tersebut.

Tambah: UUID dibuat sekali per draft dan dipakai ulang saat retry; INSERT saja.
Jika timeout/duplicate key, baca ID itu dan bandingkan payload sebelum menyimpulkan
berhasil. Jangan upsert overwrite. Hapus lalu buat ulang memakai UUID baru, sehingga
revision=1 tidak membuka masalah ABA pada identitas produk lama.

Pengurutan beberapa produk kelak memerlukan satu fungsi transaksi SECURITY INVOKER:
cek Admin, lock target dalam urutan ID tetap, validasi semua expected revisions,
update semuanya atau raise/rollback semuanya. Bukan beberapa request UPDATE terpisah.
Rancangan fungsi tersebut perlu review tambahan; tidak dibuat/diberi EXECUTE sekarang.

RLS saat ini membatasi identitas Admin, bukan mewajibkan expected revision. Admin
yang sengaja mengirim UPDATE tanpa filter masih dapat mengubah produk. Kontrak CAS
melindungi alur aplikasi kooperatif; jika CAS wajib pada seluruh API langsung, perlu
desain RPC-only dan pengetatan grants yang disetujui terpisah. Jangan mengklaim
trigger revision saja memaksakan optimistic concurrency pada semua jalur.

Sukses UI hanya setelah RETURNING mengonfirmasi baris. Setelah itu invalidate/read
ulang bersama; kegagalan tidak mengganti tampilan seolah tersimpan. Tidak ada dual-write
atau seed dari localStorage. Cross-device gunakan refetch saat fokus/manual dahulu;
Realtime/polling bukan kebutuhan awal.

## Grants, RLS, fungsi baru

Trigger SECURITY INVOKER, search_path kosong, tanpa dynamic SQL/tabel lain. Cabut
EXECUTE PUBLIC/anon/authenticated dalam transaksi pembuatan untuk menangkal defaults
luas. PostgreSQL memeriksa EXECUTE fungsi trigger saat pembuatan trigger; runtime
trigger tetap berjalan tanpa grants EXECUTE langsung bagi client. Uji ini di staging.
Verifier memeriksa effective EXECUTE termasuk PUBLIC/inheritance. Tidak mengganti
is_admin, admin_users, RLS, grants tabel, atau Auth. Kolom baru mengikuti grants tabel
existing; audit ulang column grants dan policies dengan snapshot sebelum/sesudah.
Default privileges gagal tetap pekerjaan terpisah; jangan menjalankan repair tabel
yang sudah lulus. Jangan mengubah fungsi internal Supabase.

## Staging Free manual

1. Dashboard: periksa kuota akun dan pilih organisasi Free. Buat proyek staging
   terpisah hanya jika slot Free tersedia; berhenti bila diminta upgrade/bayar.
2. Pastikan project reference staging berbeda produksi. Buat schema/RLS/grants
   melalui baseline yang ditinjau; jangan menyalin skrip repair mentah sebagai baseline.
3. Buat akun uji Admin dan non-Admin di staging saja, catat Admin staging di admin_users.
   Jangan menyalin auth.users atau ID akun produksi. Uji signup sesuai konfigurasi.
4. Gunakan checkout/direktori konfigurasi staging terpisah, URL/key staging saja.
   Jangan menimpa .env.local produksi. Tambahkan guard project reference untuk tes tulis.
5. Seed data melalui restore v2 yang ditinjau setelah persetujuan staging, mempertahankan
   ID, paket/harga, URL, WhatsApp. Jangan memakai migrator backup v1 untuk file v2.
6. Ambil metadata/ACL staging, lakukan rehearsal migrasi (akhir ROLLBACK), review hasil,
   lalu minta persetujuan commit STAGING. Produksi memerlukan persetujuan tersendiri.

Supabase menyediakan dua proyek Free aktif, tergantung kuota akun; proyek Free dapat
pause karena tidak aktif. Verifikasi Dashboard, jangan menjanjikan slot tersedia.
Sumber: https://supabase.com/docs/guides/platform/billing-faq
https://supabase.com/kb/faqs/platform/free-project-pausing

## Matriks pengujian staging (belum dijalankan)

- Sebelum/sesudah migrasi: 7 produk, 14 paket, semua field dan WhatsApp identik;
  sort_order tepat; revision=1; ACL/policies tidak berubah; trigger tepat satu.
- Anon: SELECT sesuai policy, INSERT/UPDATE/DELETE ditolak melalui API langsung.
- Login non-Admin: baca sesuai policy, semua tulis ditolak, admin_users tertutup.
- Admin: tambah/edit/hapus produk uji; edit array paket atomik; input rusak ditolak.
- Dua koneksi independen revision sama: edit/edit dan edit/delete, tepat satu sukses.
  Uji tunggu lock nyata, stale revision, baris hilang, session expired, RLS deny.
- Retry ID sama/klik ganda/timeout: tidak duplikat; retry edit tidak auto-overwrite.
- Trigger: abaikan revision palsu, revision naik, updated_at berubah, ID immutable;
  payload tidak berubah karena stale update; function EXECUTE langsung tertutup.
- Reorder atomik nanti: revisi konflik satu item membatalkan semua; rollback transaksi.
- Pengujian browser normal/preview, gambar fallback, semua durasi/harga, no local writes.
- TypeScript/build setelah implementasi website disetujui; tidak diperlukan build
  ulang sekarang karena hanya SQL/docs/test lokal ditambahkan.

## Pemulihan dan rollback

Simpan backup JSON dan ACL sebelum/sesudah. Exporter saat ini belum menyertakan
sort_order/revision dan masih memakai urutan hardcoded: WAJIB adaptasi format/version
backup dan reader sebelum CRUD aktif. Backup lama productOrder masih dapat menjadi
referensi pemulihan urutan. Backup dua pembacaan bukan snapshot transaksi; gunakan
jendela tanpa penulisan atau mekanisme transaksi yang ditinjau.

Uji restore di staging terisolasi: validasi v2, dry-run missing/identical/changed/extra,
skip-identical/abort-conflict default, tanpa delete-extra otomatis. Untuk latihan
overwrite terencana, ambil backup sebelum latihan dan persetujuan konflik eksplisit;
bandingkan seluruh nilai sesudahnya. Restore pasca-CRUD tidak boleh memundurkan
revision: blok penulisan, putus draft lama, dan rancang kebijakan revision monotonic.
Belum ada SQL restore baru dibuat atau dijalankan.

rollback-products-crud-schema.sql hanya untuk sebelum CRUD: menolak jumlah/ID/order
berbeda atau revision !=1, DROP tanpa CASCADE, akhir ROLLBACK. Sesudah CRUD, rollback
aplikasi dengan schema/data baru tetap utuh lebih aman. DROP dua kolom menghilangkan
metadata: butuh backup dan review dependensi terlebih dahulu. Metadata snapshot harus
membuktikan objek yang dihapus memang berasal dari migrasi ini. ROLLBACK biasa tidak
membatalkan COMMIT lama. Jangan kembali ke localStorage lalu mengunggah data lama.

WhatsApp tetap tahap terpisah; integrasikan reader store_settings bersama sebelum
cutover publik agar tujuan pesan tidak berbeda antarperangkat. Writer WhatsApp nanti
memerlukan kontrol konflik sendiri. Tidak ada perubahan WhatsApp dalam rancangan SQL.

Referensi concurrency: https://www.postgresql.org/docs/17/transaction-iso.html
Trigger: https://www.postgresql.org/docs/17/sql-createtrigger.html
Fungsi: https://supabase.com/docs/guides/database/functions
