# Persiapan perbaikan grants Rakyat Premium

Status: skrip disiapkan, tidak dieksekusi. Tidak ada koneksi database, perubahan data,
kode website, instalasi paket, atau deployment. Persetujuan persiapan bukan persetujuan eksekusi.

## Dampak yang dinilai sebelum penyusunan SQL

- Katalog: anon tetap SELECT products/store_settings. Nomor dan template WhatsApp tetap publik.
- Admin: authenticated tetap SELECT/INSERT/UPDATE/DELETE kedua tabel; RLS is_admin tetap membatasi penulisan. GRANT kepada authenticated bukan menjadikan semua pengguna Admin.
- admin_users: PUBLIC/anon/authenticated kehilangan semua grants langsung, termasuk kolom. Pemeriksaan keanggotaan harus memakai public.is_admin(), bukan SELECT langsung dari browser.
- is_admin: definisi, owner, SECURITY DEFINER, search_path, dan EXECUTE grants tidak diubah. Jalur baca admin_users diverifikasi melalui owner tabel dan status FORCE RLS, atau atribut superuser/BYPASSRLS. Preflight menolak perubahan policy/body fungsi dari laporan audit.
- Supabase Auth: auth.users, schema auth, JWT, authenticator, supabase_auth_admin, serta akun/sesi tidak disentuh. Login dan refresh sesi yang sudah memakai objek existing tidak ditargetkan.
- API: REST SELECT tetap tersedia; CRUD authenticated bergantung RLS. API yang mencoba membaca admin_users langsung akan mendapat penolakan akses. Frontend integrasi harus mengantisipasinya.
- Fungsi internal: rls_auto_enable dan seluruh fungsi existing lainnya tidak diubah, dihapus, atau dicabut hak eksekusinya. Schema USAGE juga dipertahankan.
- service_role dan pemilik objek tidak dicabut grants eksplisitnya. Service-role key tetap tidak boleh dipakai frontend.
- Lock perbaikan tabel bersifat singkat tetapi ACCESS EXCLUSIVE menahan pembacaan/penulisan lain sampai transaksi selesai. lock_timeout 5 detik membatalkan jika sibuk.

## File dan cakupan

1. repair-supabase-grants.sql
   - Satu transaksi; dijalankan sebagai postgres setelah ditinjau/disetujui.
   - Membersihkan grants tabel/kolom dari PUBLIC, anon, authenticated; memberikan kembali hak minimum.
   - Mencabut TRUNCATE/REFERENCES/TRIGGER/MAINTAIN melalui REVOKE ALL.
   - Tidak menggunakan CASCADE. Grant berantai yang tidak bisa dicabut secara RESTRICT menyebabkan error, bukan penghapusan dependency diam-diam.
   - Menolak role klien beratribut berbahaya atau memiliki role membership tambahan. Tidak mengubah role bersama untuk mengatasi hak warisan secara otomatis.
   - Memeriksa hak efektif dan grant option per tabel/kolom sesudah perubahan; mismatch membatalkan seluruh transaksi.
   - Memastikan policies dan definisi is_admin tidak berubah.

2. repair-default-privileges-postgres.sql
   - Transaksi terpisah untuk objek BARU yang dibuat sebagai postgres.

3. repair-default-privileges-supabase-admin.sql
   - Transaksi terpisah untuk objek BARU yang dibuat sebagai supabase_admin.
   - SQL Editor postgres pada Supabase mungkin tidak berwenang mengubah defaults role ini.
     Preflight akan menolak. Jangan menambah membership, memakai service-role key,
     mengubah owner, atau mengubah fungsi internal untuk memaksanya. Minta operator
     platform berwenang meninjau/menjalankannya. Service-role API key bukan login role SQL.

4. verify-supabase-grants.sql
   - SELECT metadata saja; menghasilkan satu JSON grants_verification.
   - Memeriksa hak efektif, kolom, grant options, inheritance, RLS, schema privileges,
     kesamaan policies/body is_admin dengan audit, dan defaults kedua creator.
   - Ringkasan terpisah: table_grants_passed, is_admin_passed, default_privileges_passed.
   - Bila defaults belum diterapkan, kegagalan kategori defaults tidak berarti perbaikan
     grants tabel gagal. Nilai kategori tabel dan fungsi diperiksa terpisah.
   - all_checks_passed tetap tersedia sebagai agregat, bukan satu-satunya hasil.

## Dampak khusus default privileges — perlu persetujuan eksplisit

Defaults pada schema public serta global dibersihkan untuk PUBLIC/anon/authenticated,
untuk tabel, sequence, dan fungsi. Objek baru harus diberi GRANT eksplisit setelah
review RLS. Tidak otomatis memberi SELECT pada setiap tabel baru karena tabel itu
bisa berisi data internal, seperti admin_users.

PostgreSQL menjumlahkan ACL default global dan per-schema. REVOKE per-schema tidak
bisa menghapus default EXECUTE untuk PUBLIC yang berasal dari global/bawaan PostgreSQL.
Karena itu, kedua file defaults juga mencabut lapisan global. Dampaknya berlaku untuk
objek BARU milik creator tersebut di SEMUA schema, termasuk fungsi yang mungkin dibuat
oleh maintenance/upgrade platform di masa depan. Hak service_role eksplisit yang ada
dipertahankan, tetapi hak yang hanya berasal dari PUBLIC tidak lagi otomatis tersedia
pada objek baru. Maintenance/upgrade perlu menetapkan grants yang memang dibutuhkan.

Perubahan default ini tidak mencabut grants fungsi/tabel existing dan tidak mengubah
fungsi internal existing. Namun cakupan masa depannya lebih luas dari katalog ini;
review operator platform diperlukan, khususnya untuk supabase_admin. Jika cakupan global
belum disetujui, jalankan hanya tahap grants tabel setelah disetujui dan laporkan defaults
sebagai belum selesai. Jangan mengklaim semua audit lulus.

## Langkah eksekusi manual setelah disetujui

1. Simpan laporan audit dan backup yang ada. Pilih proyek Supabase yang benar.
   Setelah izin eksekusi diberikan, ambil snapshot-supabase-acl.sql dan siapkan
   rollback berdasarkan snapshot aktual sesuai ACL-ROLLBACK.md sebelum perbaikan.
2. Tinjau file-file SQL, terutama cakupan global default privileges di atas.
3. Di SQL Editor dengan role postgres, jalankan SELURUH repair-supabase-grants.sql.
   Skrip menyertakan COMMIT. Jangan menjalankan REVOKE/GRANT per potongan.
4. Jalankan verify-supabase-grants.sql. Tabel/kolom dan policies harus sesuai; defaults
   belum tentu lulus sampai tahap defaults selesai.
5. Setelah persetujuan cakupan global, jalankan seluruh repair-default-privileges-postgres.sql.
6. Tahap supabase_admin hanya oleh operator yang berwenang, setelah dampak platform ditinjau.
7. Jalankan kembali verify-supabase-grants.sql dan inspect-supabase-security.sql; simpan
   hasil baru tanpa menimpa laporan audit awal. Kirim hasilnya untuk ditinjau.
8. Setelah metadata sesuai, lakukan pengujian Auth/API terpisah sebagai pengunjung,
   authenticated non-Admin, dan Admin. Tidak dilakukan oleh skrip persiapan ini.

Jika error, jangan lanjutkan fragmen tersisa. Bila sesi masih dalam transaksi gagal,
jalankan ROLLBACK sebelum mencoba lagi. Semua file perbaikan memakai transaksi terpisah:
kegagalan tahap defaults tidak membatalkan tahap grants tabel yang sudah berhasil commit.
Skrip aman dijalankan ulang pada konfigurasi yang sama; tidak ada INSERT/UPDATE/DELETE
data aplikasi, ALTER POLICY, ALTER ROLE, atau penggantian fungsi.

Pengujian saat persiapan terbatas pada pemeriksaan statis file, payload audit, scope
perintah, dan struktur transaksi. Tidak ada parser/server PostgreSQL lokal yang digunakan;
belum ada uji eksekusi pada Supabase. Build website tidak diperlukan karena kode website
dan dependensi tidak berubah.

Referensi: https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html

## Tinjauan kompatibilitas PostgreSQL 17

- REVOKE ALL PRIVILEGES ON TABLE dan REVOKE SELECT/INSERT/UPDATE/REFERENCES
  per kolom mengikuti sintaks PostgreSQL 17. RESTRICT tetap dipakai, tanpa CASCADE.
- has_table_privilege memeriksa delapan hak termasuk MAINTAIN; has_column_privilege
  hanya memeriksa SELECT, INSERT, UPDATE, REFERENCES menggunakan attnum (smallint).
  Pemeriksaan kolom mencakup hak tabel yang diwariskan ke kolom serta grant option.
- Perbandingan is_admin terhadap audit hanya menormalkan pasangan CRLF menjadi LF
  pada kedua sisi. Tidak menghapus komentar, spasi, identifier, atau token SQL.
  Body fungsi yang diaudit tidak memiliki string data multiline sehingga normalisasi
  ini tidak mengabaikan perubahan nilai string bisnis. Bila fungsi berubah, audit ulang.
- Pembandingan sebelum/sesudah dalam transaksi tetap persis untuk mendeteksi perubahan
  yang terjadi selama tahap perbaikan; penyalinan file tidak memengaruhi metadata ini.
- Perbandingan policies tetap ketat dengan output deparser PostgreSQL dari audit.
  Perbedaan selain line ending fungsi tidak diasumsikan setara secara semantik.
  Jika output deparser/policy berubah, skrip berhenti untuk telaah ulang.
- Ditambahkan pemeriksaan USAGE public untuk klien serta SELECT admin_users, USAGE auth,
  dan EXECUTE auth.uid() untuk owner postgres. Fungsi is_admin tidak dipanggil oleh audit.
- Error dari preflight, REVOKE, GRANT, atau assertion tidak ditangkap. Transaksi menjadi
  gagal; COMMIT tidak dapat menyimpan perubahan parsial. Jika klien berhenti pada error,
  ROLLBACK tetap diperlukan untuk menutup transaksi dan melepas lock.
- Uji lokal menerima varian CRLF/LF dan tetap menolak contoh perubahan auth.uid(),
  SECURITY DEFINER, tabel sumber, serta logika EXISTS. Ini pemeriksaan statis/string,
  bukan parser SQL ataupun pengujian permission PostgreSQL sebenarnya.
- psql, pg_config, Docker, dan parser PostgreSQL tidak ditemukan pada lingkungan lokal
  yang diperiksa. Tidak ada paket yang dipasang dan tidak ada koneksi produksi digunakan.

Referensi sintaks: https://www.postgresql.org/docs/17/sql-revoke.html

Referensi pemeriksaan privileges: https://www.postgresql.org/docs/17/functions-info.html

## Tinjauan owner dan BYPASSRLS

BYPASSRLS tidak diwajibkan secara terpisah. Fungsi harus tetap SECURITY DEFINER,
bertipe boolean tanpa argumen, dimiliki postgres, dan pemiliknya harus sama dengan
pemilik tabel admin_users. RLS tabel harus tetap aktif dan semua dependency baca
harus tersedia (SELECT tabel, USAGE public/auth, EXECUTE auth.uid()).

Dengan kesamaan owner tersebut, jalur baca diterima bila owner superuser atau
BYPASSRLS, atau admin_users tidak menggunakan FORCE ROW LEVEL SECURITY. Jika FORCE
aktif dan kedua atribut itu false, skrip menolak dan tidak mencoba mematikan FORCE,
mengubah owner, menambah policy, atau memberi BYPASSRLS.

Kondisi ini diuji sebelum pencabutan grants dan kembali sebelum COMMIT; verifikasi
pendamping memakai predikat yang sama. Body is_admin dan semua policy tetap
dibandingkan dengan audit. Tidak ada policy admin_users pada snapshot sehingga
jalur owner bebas RLS ini menghindari penyaringan default-deny; jika policy berubah,
audit ulang tetap diwajibkan untuk menilai kemungkinan rekursi.

rolbypassrls tersedia pada katalog PostgreSQL 17; yang tidak diwajibkan adalah
nilainya true untuk owner. Role klien tetap wajib tidak memiliki BYPASSRLS atau
superuser. Tidak ada pelonggaran untuk anon/authenticated.

Uji logika lokal mencakup 40 skenario owner/FORCE/BYPASSRLS/superuser/hak SELECT/
dependency/SECURITY DEFINER, termasuk owner tanpa BYPASSRLS dengan FORCE nonaktif
(diterima), serta FORCE aktif tanpa bypass (ditolak). Uji ini bukan eksekusi SQL.

Referensi: https://www.postgresql.org/docs/17/ddl-rowsecurity.html

## Koreksi sequence dan pemulihan berbasis snapshot

pg_default_acl.defaclobjtype memakai S untuk sequence, tetapi acldefault() memakai
s. Kedua skrip defaults dan verifier menerapkan CASE untuk pemanggilan acldefault;
filter katalog tetap menggunakan S. Jangan mengganti seluruh S menjadi s.

Lihat ACL-ROLLBACK.md untuk snapshot read-only dan generator rollback lokal.
ROLLBACK biasa hanya berlaku sebelum COMMIT. Pemulihan sesudah COMMIT membutuhkan
transaksi baru yang dibangun dari ACL aktual pra-perubahan; tidak menggunakan GRANT ALL.
Generator belum dijalankan pada snapshot produksi, karena snapshot baru belum tersedia.
Skrip defaults tetap ditunda dan tidak dijalankan sebagai bagian persiapan lokal.
