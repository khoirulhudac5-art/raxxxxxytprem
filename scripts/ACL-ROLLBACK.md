# Snapshot dan rollback grants — belum dieksekusi

Persetujuan saat ini hanya untuk persiapan file lokal. Jangan menjalankan SQL ke
Supabase sebelum ada persetujuan eksekusi terpisah.

## Snapshot sebelum perubahan

Jalankan MANUAL snapshot-supabase-acl.sql sebagai postgres, pada proyek yang benar,
setelah disetujui. Simpan hasil acl_snapshot sebagai JSON utuh di scripts/, misalnya
acl-before-table-repair.json. Format ekspor SQL Editor [{acl_snapshot:"..."}] juga
diterima generator. Snapshot harus diambil tepat sebelum tahap bersangkutan, bukan
menggunakan laporan lama. Ia merekam ACL tabel/kolom, grantor, grant option, owner,
OID tabel, RLS/FORCE, policies, definisi is_admin, serta ACL default global/public
untuk postgres dan supabase_admin. Tidak membaca isi produk atau akun.

Snapshot tidak merekam password, key, sesi Auth, dan isi tabel. Ini bukan backup data
atau bukti izin runtime; metadata/definisi fungsi tetap perlu disimpan dengan hati-hati.

## Membuat rollback lokal setelah snapshot tersedia

```
node scripts/generate-acl-rollback.cjs scripts/acl-before-table-repair.json tables scripts/rollback-table-grants.sql
```

Hanya jika tahap default terkait akan disetujui/dijalankan, ambil snapshot baru tepat
sebelumnya dan buat rollback terpisah:

```
node scripts/generate-acl-rollback.cjs scripts/acl-before-defaults.json defaults-postgres scripts/rollback-defaults-postgres.sql
node scripts/generate-acl-rollback.cjs scripts/acl-before-defaults.json defaults-supabase-admin scripts/rollback-defaults-supabase-admin.sql
```

Generator tidak terhubung ke database. Output baru hanya boleh berada di scripts/;
file existing tidak ditimpa. Tanpa snapshot aktual, jangan membuat rollback final
dari fixture atau laporan audit lama. Belum ada rollback aktual yang dihasilkan pada
tahap persiapan ini karena snapshot pra-perubahan belum tersedia.

## Cakupan dan batas pemulihan

- Pemulihan tabel hanya mereset grants PUBLIC/anon/authenticated pada tiga tabel
  target dan kolomnya, lalu memberi kembali setiap privilege dan grant option yang
  tercatat. Tidak ada GRANT ALL, CASCADE, perubahan data/policy/Auth/fungsi.
- Generator menerima grantor target tabel postgres saja. Grantor lain atau metadata
  tidak sesuai menyebabkan penolakan, bukan penggantian grantor secara diam-diam.
- Sebelum pemulihan tabel, hak efektif harus cocok dengan hasil perbaikan yang
  ditinjau. Tetap periksa perubahan ACL terbaru agar pemulihan tidak menimpa grants
  baru yang sengaja dibuat setelah snapshot. Hak role selain tiga target tidak diubah.
- OID, owner, RLS/FORCE, policies, dan definisi fungsi harus sama dengan snapshot.
  Database name/OID bukan identitas proyek global; operator wajib memilih proyek benar.
- Pemulihan defaults dibatasi pada creator yang dipilih dan grantee target, untuk
  objek tabel/sequence/fungsi di global/public. Mengembalikan hak efektif snapshot,
  bukan menjamin representasi raw NULL/entry ACL identik. Tidak memulihkan ACL objek
  yang sudah dibuat setelah defaults diubah; objek tersebut memerlukan review sendiri.
- Generator memeriksa ulang ACL target yang dihasilkan terhadap snapshot sebelum
  akhir transaksi; perbedaan membatalkan transaksi. Tetap lakukan audit read-only baru.
- Rollback mengembalikan hak lama, termasuk hak berlebihan jika ada dalam snapshot.
  Karena itu gunakan hanya untuk gangguan yang terkonfirmasi, setelah persetujuan;
  jangan gunakan sebagai langkah otomatis saat satu check default masih false.

## Transaksi dan pelaksanaan

Semua output rollback berakhir dengan ROLLBACK sebagai rehearsal. Jika disetujui untuk
menguji rehearsal, grants akan berubah hanya selama transaksi lalu dikembalikan;
ini tetap operasi perubahan metadata dan tidak boleh dijalankan pada tahap read-only.
Untuk pemulihan pasca-COMMIT yang sebenarnya, tinjau output dan snapshot aktual, lalu
ganti HANYA ROLLBACK terakhir dengan COMMIT setelah persetujuan eksplisit. Jalankan
seluruh file. Jangan melanjutkan potongan setelah error atau menonaktifkan guard.

Sebelum COMMIT perbaikan, error membuat transaksi gagal dan perubahan tidak tersimpan;
ROLLBACK menutup sesi transaksi gagal dan melepas lock. Setelah COMMIT, ROLLBACK biasa
tidak membatalkan perbaikan: diperlukan transaksi pemulihan baru dari snapshot.
Ketiga tahap perbaikan terpisah; kegagalan defaults tidak membatalkan perbaikan tabel
yang telah di-commit. ACCESS EXCLUSIVE dapat menahan pembaca selama pemulihan tabel.

## Ringkasan verifikasi terpisah

verify-supabase-grants.sql sekarang menghasilkan:
- table_grants_passed: hak tabel/kolom, role, RLS/schema dan kesamaan policies.
- is_admin_passed: definisi, owner, jalur baca RLS dan EXECUTE helper.
- default_privileges_passed: defaults kedua creator.
- all_checks_passed: gabungan seluruh kategori; bukan satu-satunya ukuran keberhasilan.

Jika defaults belum dijalankan, default_privileges_passed boleh false. Keberhasilan
tahap tabel dinilai dari table_grants_passed DAN is_admin_passed, bukan agregat akhir.
Koreksi sequence memakai S untuk pg_default_acl dan s untuk acldefault().

## Urutan paling aman setelah persetujuan eksekusi

1. Audit metadata terbaru dan ambil snapshot pra-perubahan.
2. Hasilkan, tinjau, dan simpan rollback tabel sebelum menjalankan perbaikan.
3. Jalankan repair-supabase-grants.sql saja dalam satu transaksi, pada waktu sepi.
4. Jalankan verify-supabase-grants.sql dan inspect-supabase-security.sql.
5. Pastikan kategori tabel dan is_admin lulus, lalu verifikasi backup produk/WhatsApp
   dan SELECT anon. Uji non-Admin/Admin dilakukan terpisah di lingkungan uji.
6. Tunda defaults. Jika nanti disetujui, ambil snapshot baru, buat rollback terpisah,
   lalu review cakupan global dan kewenangan supabase_admin bersama operator platform.
7. Jangan menambah role membership atau memberi key istimewa demi meloloskan skrip.

Default global memengaruhi objek BARU di semua schema milik creator tersebut. Auth
dan fungsi existing tidak diubah, tetapi maintenance platform masa depan mungkin
memerlukan grants eksplisit. Perlakuan ini tetap memerlukan review terpisah.

Validasi lokal: node scripts/test-acl-preparation.cjs. Ini uji statis/generator,
bukan parser atau engine PostgreSQL. Tidak ada SQL produksi dijalankan.
