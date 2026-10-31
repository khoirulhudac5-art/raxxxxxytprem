-- Rakyat Premium: audit metadata keamanan, READ ONLY / SELECT saja.
-- Jalankan SELURUH file di Supabase SQL Editor sebagai pemilik proyek (postgres).
-- Satu kolom JSON: security_report. Simpan hasilnya untuk ditinjau sebelum integrasi.
-- Tidak membaca isi admin_users/auth.users, tidak menjalankan is_admin()/RPC,
-- tidak mensimulasikan INSERT/UPDATE/DELETE, tidak mengganti role atau JWT.
-- Grants bukan izin efektif per baris: harus dibaca bersama seluruh policies.
-- Audit statis ini belum membuktikan akses Admin/non-Admin secara end-to-end.
-- Dependency katalog tidak selalu menangkap referensi SQL dinamis/body teks fungsi.

WITH target_tables AS (
 SELECT c.oid, c.relname, c.relowner, c.relrowsecurity, c.relforcerowsecurity, c.relacl
 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
  AND c.relname IN ('products','store_settings','admin_users')
  AND c.relkind IN ('r','p')
), client_roles AS (
 SELECT oid, rolname, rolsuper, rolbypassrls, rolinherit, rolcreaterole, rolcreatedb
 FROM pg_roles WHERE rolname IN ('anon','authenticated')
), inspected_functions AS (
 -- Semua overload is_admin di schema mana pun + fungsi aplikasi SECURITY DEFINER
 -- + helper yang tercatat dipanggil langsung oleh policy tabel sasaran.
 SELECT DISTINCT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind IN ('f','p') AND (
  p.proname = 'is_admin'
  OR (p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema','auth','storage',
    'extensions','realtime','graphql','graphql_public','supabase_functions','vault',
    'pgsodium','pgsodium_masks','net') AND n.nspname NOT LIKE 'pg_%')
  OR p.oid IN (
   SELECT d.refobjid FROM pg_depend d JOIN pg_policy pol ON pol.oid=d.objid
   WHERE d.classid='pg_policy'::regclass AND d.refclassid='pg_proc'::regclass
    AND pol.polrelid IN (SELECT oid FROM target_tables)
  )
 )
), report AS (
 SELECT jsonb_build_object(
 'context', jsonb_build_object('database', current_database(), 'current_user', current_user,
  'session_user', session_user, 'server_version', current_setting('server_version'),
  'search_path', current_setting('search_path'),
  'note', 'Metadata saja. Tidak ada keputusan AMAN otomatis; perlu telaah policy, helper, dan pengujian identitas terpisah.'),
 'missing_tables', (
  SELECT coalesce(jsonb_agg(name), '[]'::jsonb)
  FROM (VALUES ('products'),('store_settings'),('admin_users')) expected(name)
  WHERE NOT EXISTS (SELECT 1 FROM target_tables t WHERE t.relname=expected.name)
 ),
 'tables', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.relname,
   'owner',pg_get_userbyid(t.relowner),'rls_enabled',t.relrowsecurity,
   'force_rls',t.relforcerowsecurity,'raw_acl',t.relacl::text,
   'owner_superuser',r.rolsuper,'owner_bypassrls',r.rolbypassrls) ORDER BY t.relname),'[]'::jsonb)
  FROM target_tables t JOIN pg_roles r ON r.oid=t.relowner
 ),
 'policies', (
  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname),'[]'::jsonb)
  FROM pg_policies p WHERE p.schemaname='public'
   AND p.tablename IN ('products','store_settings','admin_users')
 ),
 'table_grants_explicit_or_default', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.relname,
   'grantor',pg_get_userbyid(a.grantor),
   'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
   'privilege',a.privilege_type,'grantable',a.is_grantable)
   ORDER BY t.relname,a.grantee,a.privilege_type),'[]'::jsonb)
  FROM target_tables t CROSS JOIN LATERAL aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) a
 ),
 'effective_client_table_privileges_before_rls', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'table',t.relname,
   'select',has_table_privilege(r.oid,t.oid,'SELECT'),
   'insert',has_table_privilege(r.oid,t.oid,'INSERT'),
   'update',has_table_privilege(r.oid,t.oid,'UPDATE'),
   'delete',has_table_privilege(r.oid,t.oid,'DELETE'),
   'truncate',has_table_privilege(r.oid,t.oid,'TRUNCATE'),
   'references',has_table_privilege(r.oid,t.oid,'REFERENCES'),
   'trigger',has_table_privilege(r.oid,t.oid,'TRIGGER'),
   'inherits_table_owner',pg_has_role(r.oid,t.relowner,'USAGE'))
   ORDER BY r.rolname,t.relname),'[]'::jsonb)
  FROM client_roles r CROSS JOIN target_tables t
 ),
 'effective_client_column_privileges_before_rls', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'table',t.relname,
   'column',a.attname,'raw_column_acl',a.attacl::text,
   'select',has_column_privilege(r.oid,t.oid,a.attnum,'SELECT'),
   'insert',has_column_privilege(r.oid,t.oid,a.attnum,'INSERT'),
   'update',has_column_privilege(r.oid,t.oid,a.attnum,'UPDATE'),
   'references',has_column_privilege(r.oid,t.oid,a.attnum,'REFERENCES'))
   ORDER BY r.rolname,t.relname,a.attnum),'[]'::jsonb)
  FROM client_roles r CROSS JOIN target_tables t
  JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
 ),
 'client_roles', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY rolname),'[]'::jsonb) FROM client_roles r),
 'inherited_roles', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('client',r.rolname,'role',other.rolname,
   'superuser',other.rolsuper,'bypassrls',other.rolbypassrls,
   'createrole',other.rolcreaterole,'can_inherit',pg_has_role(r.oid,other.oid,'USAGE'))
   ORDER BY r.rolname,other.rolname),'[]'::jsonb)
  FROM client_roles r JOIN pg_roles other ON other.oid<>r.oid
   AND pg_has_role(r.oid,other.oid,'MEMBER')
 ),
 'schema_access', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'schema',n.nspname,
   'owner',pg_get_userbyid(n.nspowner),'raw_acl',n.nspacl::text,
   'usage',has_schema_privilege(r.oid,n.oid,'USAGE'),
   'create',has_schema_privilege(r.oid,n.oid,'CREATE')) ORDER BY r.rolname,n.nspname),'[]'::jsonb)
  FROM client_roles r CROSS JOIN pg_namespace n
  WHERE n.nspname='public' OR n.oid IN (SELECT pronamespace FROM inspected_functions)
 ),
 'functions', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,
   'signature',p.oid::regprocedure::text,'arguments',pg_get_function_arguments(p.oid),
   'result',pg_get_function_result(p.oid),'language',l.lanname,
   'owner',owner.rolname,'owner_superuser',owner.rolsuper,'owner_bypassrls',owner.rolbypassrls,
   'security_definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile,
   'raw_acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) ORDER BY n.nspname,p.proname,p.oid),'[]'::jsonb)
  FROM inspected_functions p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_roles owner ON owner.oid=p.proowner JOIN pg_language l ON l.oid=p.prolang
 ),
 'function_grants_explicit_or_default', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('function',p.oid::regprocedure::text,
   'grantor',pg_get_userbyid(a.grantor),
   'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
   'privilege',a.privilege_type,'grantable',a.is_grantable)
   ORDER BY p.oid,a.grantee),'[]'::jsonb)
  FROM inspected_functions p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 ),
 'effective_client_function_privileges', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,
   'function',p.oid::regprocedure::text,'execute',has_function_privilege(r.oid,p.oid,'EXECUTE'))
   ORDER BY r.rolname,p.oid),'[]'::jsonb)
  FROM client_roles r CROSS JOIN inspected_functions p
 ),
 'policy_dependencies', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.relname,'policy',pol.polname,
   'referenced_object',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid))
   ORDER BY t.relname,pol.polname,d.refclassid,d.refobjid),'[]'::jsonb)
  FROM pg_policy pol JOIN target_tables t ON t.oid=pol.polrelid
  JOIN pg_depend d ON d.classid='pg_policy'::regclass AND d.objid=pol.oid
 ),
 'function_dependencies_recorded_only', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('function',p.oid::regprocedure::text,
   'referenced_object',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid))
   ORDER BY p.oid,d.refclassid,d.refobjid),'[]'::jsonb)
  FROM inspected_functions p JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid
 ),
 'default_grants', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('creator',pg_get_userbyid(d.defaclrole),
   'schema',CASE WHEN d.defaclnamespace=0 THEN '(all schemas)' ELSE n.nspname END,
   'object_type',d.defaclobjtype,'acl',d.defaclacl::text)),'[]'::jsonb)
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
  WHERE d.defaclnamespace=0 OR n.nspname='public'
   OR n.oid IN (SELECT pronamespace FROM inspected_functions)
 ),
 'public_views_for_bypass_review', (
  SELECT coalesce(jsonb_agg(jsonb_build_object('view',c.relname,'kind',c.relkind,
   'owner',pg_get_userbyid(c.relowner),'options',c.reloptions,
   'definition',pg_get_viewdef(c.oid,true),
   'anon_select',has_table_privilege('anon',c.oid,'SELECT'),
   'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT')) ORDER BY c.relname),'[]'::jsonb)
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('v','m')
 ),
 'review_checklist', jsonb_build_array(
  'Ketiga tabel harus ada dan RLS aktif. anon/authenticated tidak boleh superuser, BYPASSRLS, atau mewarisi owner.',
  'SELECT katalog harus diizinkan; semua permissive policy untuk INSERT/UPDATE/DELETE/ALL harus ditelaah bersama, termasuk policy PUBLIC.',
  'INSERT membutuhkan WITH CHECK Admin; UPDATE membutuhkan USING dan WITH CHECK efektif Admin; DELETE membutuhkan USING Admin. WITH CHECK yang tidak ditulis dapat mewarisi USING.',
  'authenticated bukan sinonim Admin. Keanggotaan harus ditentukan dari auth.uid() dan admin_users, bukan user_metadata atau ID bebas dari pemanggil.',
  'admin_users tidak boleh memungkinkan non-Admin menambahkan/mengubah keanggotaannya sendiri, baik langsung, melalui kolom tertentu, maupun RPC SECURITY DEFINER.',
  'TRUNCATE tidak dilindungi RLS: grants TRUNCATE untuk role klien adalah temuan kritis. Periksa juga hak grantable, REFERENCES, TRIGGER, CREATE schema dan role inheritance.',
  'is_admin harus diperiksa seluruh overload, owner, EXECUTE grants, SECURITY DEFINER dan search_path. search_path harus aman; referensi tabel/function harus schema-qualified.',
  'Policy admin_users yang membaca admin_users sendiri atau memanggil helper yang kembali terkena policy yang sama berpotensi rekursif. SECURITY DEFINER saja belum membuktikan aman: tinjau owner/BYPASSRLS/FORCE RLS dan body/helper lanjutannya.',
  'Fungsi SECURITY DEFINER lain dan view dapat membuka jalur bypass. Telusuri helper dinamis/non-public yang disebut definition; daftar fungsi di sini bukan inventaris lengkap semua RPC/schema terekspos.',
  'Definisi fungsi/view dapat berisi informasi implementasi sensitif. Tinjau hasil sebelum dibagikan; tidak perlu mengirim password atau API key.',
  'SQL Editor sebagai postgres tidak membuktikan akses aplikasi. Setelah telaah metadata, diperlukan pengujian terpisah sebagai pengunjung, authenticated non-Admin, dan Admin. Tidak dilakukan oleh skrip ini.'
 )
 ) AS data
)
SELECT jsonb_pretty(data) AS security_report FROM report;
