# Migrasi backup Rakyat Premium ke Supabase

Status: SQL sudah disiapkan dan diperiksa secara statis. Belum dijalankan pada PostgreSQL/Supabase. Tidak ada perubahan database yang dilakukan. Eksekusi menunggu persetujuan pemilik.

## File

- migrate-backup-to-supabase.sql: transaksi migrasi lengkap dengan pemeriksaan struktur, konflik, dan verifikasi sebelum COMMIT.
- verify-backup-migration.sql: query SELECT terpisah untuk memeriksa data aktual terhadap seluruh isi backup.
- validate-backup.cjs: validasi lokal backup tanpa koneksi database.
- supabase-schema.json: snapshot struktur yang menjadi dasar pemetaan; format ekspor SQL Editor berisi migration_schema berupa string JSON.

## Sumber dan hasil pemeriksaan

Backup: rakyat-premium-backup-2026-10-30T09-05-23-204Z.json di akar proyek.
SHA-256: 2a1c4db291b9bcba7f2a0b90a786e34135b42e70ece492146beec85816e3f401.
Tanggal ekspor: 2026-10-30T09:05:23.204Z.

Validasi lokal lulus: 7 ID unik, 14 paket, harga bilangan bulat nonnegatif, 1 URL gambar PNG HTTPS dan 6 URL kosong, nomor WhatsApp valid, serta template dengan variabel produk/durasi/harga. Ketersediaan file gambar eksternal tidak diuji.

Struktur yang diverifikasi dari snapshot:

| Backup | Kolom tujuan | Tipe |
| --- | --- | --- |
| id, name, description, category, icon, color, badge | products: nama kolom sama | text |
| imageUrl | products.image_url | text |
| plans (seluruh durasi, harga, urutan) | products.plans | jsonb |
| whatsapp.number | store_settings.whatsapp_number | text |
| whatsapp.template | store_settings.whatsapp_template | text |

Primary key kedua tabel adalah id bertipe text. Tidak ada constraint tambahan atau trigger aplikasi pada kedua tabel di snapshot. Timestamp dibuat oleh default database now(), karena backup tidak memiliki timestamp per produk. ID produk chatgpt, capcut, canva, google, youtube, spotify, zoom dipertahankan persis.

Backup tidak memiliki ID untuk pengaturan. Migrasi menetapkan satu ID baru, main, pada store_settings. Jika ada baris pengaturan dengan ID lain, transaksi dibatalkan agar tidak membuat konfigurasi ganda. Integrasi aplikasi berikutnya harus menggunakan ID main atau ditinjau ulang secara eksplisit.

## Perilaku keselamatan

- BEGIN/COMMIT mencakup kedua tabel; error membatalkan seluruh transaksi.
- Lock EXCLUSIVE mencegah penulisan bersamaan selama pemeriksaan dan penyisipan. SELECT biasa tetap dapat berjalan. Lock timeout 5 detik; statement timeout 60 detik.
- Struktur kolom, constraint, indeks, dan ketiadaan trigger diperiksa lagi terhadap snapshot sebelum INSERT. Jika berubah, skrip berhenti.
- Hanya INSERT untuk ID yang belum ada. Data sumber yang sudah identik dilewati; perbedaan pada field mana pun menyebabkan error sebelum INSERT.
- Tidak ada UPDATE/DELETE, perubahan admin_users/auth, ALTER RLS/policy, atau akses localStorage.
- Produk lain di luar 7 ID sumber dibiarkan tetap ada.
- Seluruh field sumber dibandingkan lagi sebelum COMMIT, termasuk urutan array plans, URL kosong, serta baris baru template. Urutan key object JSON tidak signifikan; nilai dan urutan array dipertahankan.
- created_at/updated_at bukan bagian backup; tidak dipakai untuk menentukan konflik dan tidak diubah saat dijalankan ulang.
- Tidak ada password, service-role key, atau koneksi otomatis di file.

## Langkah manual setelah disetujui

1. Pastikan proyek Supabase yang dipilih benar. Buka SQL Editor sebagai pemilik proyek dengan role postgres agar pemeriksaan membaca seluruh baris, bukan subset yang dibatasi RLS. Jangan menonaktifkan RLS.
2. Opsional: jalankan seluruh verify-backup-migration.sql terlebih dahulu. Pada database kosong hasil MISSING/false memang diharapkan. DIFFERENT menandakan konflik yang perlu ditinjau, bukan ditimpa.
3. Tinjau seluruh migrate-backup-to-supabase.sql, termasuk pemetaan dan ID pengaturan main. Jangan mengubah payload atau menjalankan bagian INSERT secara terpisah.
4. Setelah persetujuan, buka New query, salin SELURUH file migrasi dari BEGIN sampai COMMIT, lalu Run. Skrip final menyertakan COMMIT; menjalankannya berarti menyetujui penyimpanan data.
5. Jika ada error, jangan lanjutkan potongan skrip. Jalankan ROLLBACK; bila sesi masih berada dalam transaksi gagal, lalu periksa penyebabnya. Jangan menghapus constraint, mengganti ID, atau menonaktifkan RLS agar skrip lolos.
6. Pada query baru, jalankan seluruh verify-backup-migration.sql. Hasil yang diharapkan: 7 baris product MATCH, 1 baris whatsapp MATCH, dan summary.matches_backup=true (total 9 baris). Seluruh detail durasi/harga dibandingkan melalui kesetaraan JSONB, bukan sekadar jumlah baris.
7. Pada database awal kosong, jumlah akhir produk adalah 7 dan pengaturan 1. Admin tetap 1 sesuai kondisi awal; skrip tidak menyentuh tabel Admin.
8. Menjalankan ulang migrasi dengan data identik tidak menambahkan baris dan tidak mengubah timestamp. Jika data telah diedit setelah migrasi, jalankan verifikasi untuk meninjau perbedaan; jangan mengharapkan backup lama menimpanya.

Pemeriksaan lokal yang telah dilakukan: validator backup lulus; payload pada kedua SQL sama persis dengan JSON sumber; metadata 15 kolom cocok snapshot; dollar quote berpasangan; urutan lock, konflik, INSERT, verifikasi, COMMIT diperiksa. PostgreSQL lokal tidak tersedia, sehingga belum ada uji eksekusi SQL. Tidak ada SQL dikirim ke Supabase.

Migrasi ini hanya memindahkan data. Website masih memakai localStorage sampai integrasi Supabase dikerjakan terpisah. Backup asli, tampilan, fitur website, dan data browser tidak diubah.
