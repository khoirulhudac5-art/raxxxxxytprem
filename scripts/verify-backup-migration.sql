-- Rakyat Premium: backup aktual 2026-10-30T09:05:23.204Z
-- SHA-256 file backup: 2a1c4db291b9bcba7f2a0b90a786e34135b42e70ece492146beec85816e3f401
-- MANUAL ONLY: tidak ada koneksi otomatis atau perubahan Admin/RLS/auth.
-- Baca scripts/MIGRATION.md terlebih dahulu. Jalankan SELURUH file, jangan per potongan.

-- READ ONLY: satu snapshot query, tidak membutuhkan tabel sementara dari migrasi.
WITH rp_backup_source AS (
 SELECT $rp_backup${
  "app": "rakyat-premium",
  "version": 1,
  "exportedAt": "2026-10-30T09:05:23.204Z",
  "source": "localStorage",
  "products": [
    {
      "id": "chatgpt",
      "name": "ChatGPT Plus",
      "description": "Teman berpikir untuk ide, menulis, dan pekerjaan sehari-hari.",
      "category": "AI Tools",
      "icon": "spark",
      "color": "green",
      "badge": "Favorit",
      "plans": [
        {
          "duration": "1 bulan",
          "price": 45000
        },
        {
          "duration": "3 bulan",
          "price": 120000
        }
      ],
      "imageUrl": "https://i.ibb.co.com/2DCDFPW/10-20261020-135930-0002.png"
    },
    {
      "id": "capcut",
      "name": "CapCut Pro",
      "description": "Wujudkan video kreatif dengan proses editing yang lebih praktis.",
      "category": "Desain & Video",
      "icon": "video",
      "color": "white",
      "badge": "Populer",
      "plans": [
        {
          "duration": "1 bulan",
          "price": 25000
        },
        {
          "duration": "3 bulan",
          "price": 65000
        }
      ],
      "imageUrl": ""
    },
    {
      "id": "canva",
      "name": "Canva Pro",
      "description": "Dari presentasi sampai konten sosial, buat desain lebih mudah.",
      "category": "Desain & Video",
      "icon": "design",
      "color": "cyan",
      "badge": "",
      "plans": [
        {
          "duration": "1 bulan",
          "price": 15000
        },
        {
          "duration": "1 tahun",
          "price": 100000
        }
      ],
      "imageUrl": ""
    },
    {
      "id": "google",
      "name": "Google AI Pro",
      "description": "Jelajahi ide dan bantu produktivitas dengan kecerdasan AI.",
      "category": "AI Tools",
      "icon": "gem",
      "color": "blue",
      "badge": "",
      "plans": [
        {
          "duration": "1 bulan",
          "price": 35000
        },
        {
          "duration": "3 bulan",
          "price": 90000
        }
      ],
      "imageUrl": ""
    },
    {
      "id": "youtube",
      "name": "YouTube Premium",
      "description": "Nikmati waktu menonton dan dengarkan konten favoritmu.",
      "category": "Streaming",
      "icon": "play",
      "color": "red",
      "badge": "",
      "plans": [
        {
          "duration": "1 bulan",
          "price": 20000
        },
        {
          "duration": "3 bulan",
          "price": 55000
        }
      ],
      "imageUrl": ""
    },
    {
      "id": "spotify",
      "name": "Spotify Premium",
      "description": "Temani setiap aktivitas dengan musik dan podcast pilihan.",
      "category": "Streaming",
      "icon": "music",
      "color": "lime",
      "badge": "",
      "plans": [
        {
          "duration": "1 bulan",
          "price": 20000
        },
        {
          "duration": "3 bulan",
          "price": 50000
        }
      ],
      "imageUrl": ""
    },
    {
      "id": "zoom",
      "name": "Zoom Pro",
      "description": "Tetap terhubung untuk meeting, kelas, dan kolaborasi online.",
      "category": "Produktivitas",
      "icon": "camera",
      "color": "blue",
      "badge": "",
      "plans": [
        {
          "duration": "1 bulan",
          "price": 30000
        },
        {
          "duration": "3 bulan",
          "price": 80000
        }
      ],
      "imageUrl": ""
    }
  ],
  "whatsapp": {
    "number": "6281249242714",
    "template": "Halo Admin Rakyat Premium, saya mau order.\n\nProduk: {produk}\nDurasi: {durasi}\nHarga: {harga}\n\nApakah produknya masih tersedia?"
  }
}$rp_backup$::jsonb AS data
), rp_expected_products AS (
 SELECT p.id,p.name,p.description,p.category,p.icon,p.color,p.badge,
       p."imageUrl" AS image_url,p.plans
FROM jsonb_to_recordset((SELECT data->'products' FROM rp_backup_source))
 AS p(id text,name text,description text,category text,icon text,color text,
      badge text,"imageUrl" text,plans jsonb)
), rp_expected_settings AS (
 SELECT 'main'::text AS id,data->'whatsapp'->>'number' AS whatsapp_number,
       data->'whatsapp'->>'template' AS whatsapp_template FROM rp_backup_source
), product_checks AS (
 SELECT 'product'::text AS kind,e.id,
        p.id IS NOT NULL AND ((to_jsonb(p) - 'created_at' - 'updated_at') IS NOT DISTINCT FROM to_jsonb(e)) AS matches_backup,
        CASE WHEN p.id IS NULL THEN 'MISSING'
             WHEN (to_jsonb(p) - 'created_at' - 'updated_at') IS NOT DISTINCT FROM to_jsonb(e) THEN 'MATCH' ELSE 'DIFFERENT' END AS status
 FROM rp_expected_products e LEFT JOIN public.products p ON p.id=e.id
), settings_checks AS (
 SELECT 'whatsapp'::text AS kind,e.id,
        s.id IS NOT NULL AND ((to_jsonb(s) - 'updated_at') IS NOT DISTINCT FROM to_jsonb(e)) AS matches_backup,
        CASE WHEN s.id IS NULL THEN 'MISSING'
             WHEN (to_jsonb(s) - 'updated_at') IS NOT DISTINCT FROM to_jsonb(e) THEN 'MATCH' ELSE 'DIFFERENT' END AS status
 FROM rp_expected_settings e LEFT JOIN public.store_settings s ON s.id=e.id
), checks AS (
 SELECT * FROM product_checks UNION ALL SELECT * FROM settings_checks
), summary AS (
 SELECT 'summary'::text AS kind,'all'::text AS id,
  (SELECT count(*)=7 AND bool_and(matches_backup) FROM product_checks)
  AND (SELECT count(*)=1 AND bool_and(matches_backup) FROM settings_checks)
  AND NOT EXISTS (SELECT 1 FROM public.store_settings WHERE id <> 'main') AS matches_backup,
  'Harus ada 7 product MATCH dan 1 whatsapp MATCH; summary harus true. Produk lain tidak diubah.'::text AS status
)
SELECT * FROM checks UNION ALL SELECT * FROM summary ORDER BY kind,id;
