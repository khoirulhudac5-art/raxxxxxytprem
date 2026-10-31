-- READ ONLY. Satu hasil JSON agar struktur mudah disalin tanpa kehilangan tab hasil.
-- Jalankan manual di SQL Editor. Tidak membaca isi akun Admin atau kredensial.
SELECT jsonb_pretty(jsonb_build_object(
 'columns', (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.table_name, x.ordinal_position), '[]'::jsonb)
  FROM (
   SELECT table_name, ordinal_position, column_name, data_type, udt_schema,
          udt_name, character_maximum_length, numeric_precision, numeric_scale,
          is_nullable, column_default, is_identity, is_generated, generation_expression
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name IN ('products','store_settings','admin_users')
  ) x
 ),
 'constraints', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('table_name', c.relname,
   'name', con.conname, 'definition', pg_get_constraintdef(con.oid)) ORDER BY c.relname, con.conname), '[]'::jsonb)
  FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('products','store_settings','admin_users')
 ),
 'indexes', (
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.tablename, x.indexname), '[]'::jsonb)
  FROM (SELECT tablename, indexname, indexdef FROM pg_indexes
   WHERE schemaname = 'public' AND tablename IN ('products','store_settings','admin_users')) x
 ),
 'triggers', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('table_name', c.relname,
   'name', t.tgname, 'definition', pg_get_triggerdef(t.oid))), '[]'::jsonb)
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
   AND c.relname IN ('products','store_settings','admin_users')
 ),
 'row_counts', jsonb_build_object('products', (SELECT count(*) FROM public.products),
   'store_settings', (SELECT count(*) FROM public.store_settings),
   'admin_users', (SELECT count(*) FROM public.admin_users))
)) AS migration_schema;
