-- Pemeriksaan struktur saja. Tidak mengubah tabel, RLS, atau data.
-- Jalankan manual di SQL Editor Supabase, lalu simpan hasil setiap SELECT.

-- 1. Kolom, tipe data, nullability, dan default.
SELECT table_name, ordinal_position, column_name, data_type,
       udt_name, is_nullable, column_default, is_identity, is_generated
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('products', 'store_settings', 'admin_users')
ORDER BY table_name, ordinal_position;

-- 2. Primary key, unique, foreign key, dan check constraints.
SELECT c.relname AS table_name, con.conname AS constraint_name,
       con.contype AS constraint_type,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('products', 'store_settings', 'admin_users')
ORDER BY c.relname, con.conname;

-- 3. Indeks, termasuk indeks unik di luar constraint.
SELECT tablename AS table_name, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('products', 'store_settings', 'admin_users')
ORDER BY tablename, indexname;

-- 4. Status RLS.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('products', 'store_settings', 'admin_users')
  AND c.relkind IN ('r', 'p');

-- 5. Kebijakan akses. Tidak membaca akun atau kredensial Admin.
SELECT tablename AS table_name, policyname, permissive, roles, cmd,
       qual AS using_expression, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'store_settings', 'admin_users')
ORDER BY tablename, policyname;

-- 6. Trigger yang mungkin berjalan saat migrasi.
SELECT c.relname AS table_name, t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND c.relname IN ('products', 'store_settings', 'admin_users')
ORDER BY c.relname, t.tgname;

-- 7. Jumlah data yang sudah ada; tidak menampilkan isi data pribadi.
SELECT 'products' AS table_name, count(*) AS row_count FROM public.products
UNION ALL
SELECT 'store_settings', count(*) FROM public.store_settings
UNION ALL
SELECT 'admin_users', count(*) FROM public.admin_users;
