# Analytics anonim otomatis

Perubahan lokal ini belum dipush atau dideploy. Tidak ada SQL yang dijalankan atau data produk yang diubah.

## Penerbitan manual

1. Tinjau perubahan tracker, API, kontrak payload, privasi, dan dashboard. Jalankan npm.cmd run build dan node scripts/test-analytics.cjs.
2. Gunakan project Supabase production yang saat ini terhubung. Pertahankan RPC analytics_ingest_v1 dan analytics_summary_v1 yang sudah terpasang; pembaruan ini tidak memerlukan migrasi. Jangan jalankan ulang skrip instalasi production jika objek sudah ada.
3. Di konfigurasi hosting production, pastikan ANALYTICS_ENABLED=true, ANALYTICS_PUBLIC_ORIGIN=https://rakyatpremium.digital, NEXT_PUBLIC_SUPABASE_URL menunjuk project production yang sama, ANALYTICS_APPROVED_SUPABASE_URL sama persis dengan URL tersebut, dan ANALYTICS_INGEST_SECRET berisi kredensial server untuk RPC production. Jangan menaruh secret dalam variabel NEXT_PUBLIC. ANALYTICS_VISITOR_HMAC_SECRET tidak dipakai lagi. Pertahankan pengaturan katalog yang ada.
4. Pastikan pekerjaan retensi analytics_prune_v1 yang ada tetap berjalan setiap hari. Tidak ada penjadwalan atau penghapusan data yang dilakukan oleh perubahan ini.
5. Setelah peninjauan, commit/push dan deploy secara manual melalui alur hosting yang biasa dipakai.
6. Verifikasi di browser tanpa login Admin: membuka katalog menghasilkan POST /api/analytics (204), lalu uji klik produk, pergantian katalog, dan pembelian WhatsApp untuk kedua katalog. Tidak perlu menekan tombol persetujuan. Pastikan tidak ada cookie atau ID localStorage Analytics baru. DNT/GPC dan pemblokir dapat menonaktifkan pencatatan. Periksa kenaikan tayangan dan klik pada dashboard Admin.

## Kompatibilitas dan batasan

Payload hanya berisi ID kejadian, jenis, katalog, label halaman yang diizinkan, dan ID produk bila perlu. Server membuat nilai acak baru untuk parameter p_visitor pada setiap kejadian demi kompatibilitas dengan RPC lama. Kolom visitor_key/session_id dan tabel analytics_visitors lama masih diisi oleh RPC, tetapi nilai baru tidak menghubungkan beberapa kejadian atau mengidentifikasi pengunjung. Angka visits/visitors dari RPC sengaja tidak ditampilkan sebagai metrik pengunjung atau sesi. Data lama tetap termasuk dalam jumlah tayangan/klik periode terpilih; tidak ada penghapusan data historis.

Identitas browser lama dibersihkan pada kunjungan berikutnya. Dashboard mempertahankan tata letak, memakai total aktivitas dan grafik tayangan halaman, serta menyatakan bahwa unik/sesi tidak dihitung. Retensi lama tetap berlaku. Kuota bersama dan pembatasan per-instance tetap ada; kuota per-pengunjung pada RPC lama tidak lagi berfungsi sebagai batas per-orang karena tidak ada identitas pengunjung. Tidak ada IP atau fingerprint yang digunakan sebagai pengganti.

Pengujian lokal memakai mock tanpa akses jaringan. Koneksi, konfigurasi hosting, hasil RPC production, dan penjadwalan retensi harus diverifikasi saat penerbitan; build lokal bukan bukti penerimaan data production.
