-- READ ONLY. Satu query metadata; tidak memanggil is_admin() dan tidak mengubah database.
-- Jalankan sebagai pemilik proyek. Ringkasan tabel, fungsi, dan defaults terpisah; all_checks_passed hanya agregat.
WITH tables AS (
 SELECT c.oid,c.relname,c.relowner,c.relrowsecurity FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND c.relname IN ('products','store_settings','admin_users') AND c.relkind='r'
), roles AS (SELECT * FROM pg_roles WHERE rolname IN ('anon','authenticated')),
privileges AS (
 SELECT r.rolname,t.relname,v.priv,
 has_table_privilege(r.oid,t.oid,v.priv) AS actual,
 t.relname<>'admin_users' AND (v.priv='SELECT' OR
  (r.rolname='authenticated' AND v.priv IN ('INSERT','UPDATE','DELETE'))) AS expected,
 has_table_privilege(r.oid,t.oid,v.priv || ' WITH GRANT OPTION') AS grant_option
 FROM roles r CROSS JOIN tables t CROSS JOIN
 (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) v(priv)
), columns_check AS (
 SELECT r.rolname,t.relname,a.attname,v.priv,
 has_column_privilege(r.oid,t.oid,a.attnum,v.priv) AS actual,
 t.relname<>'admin_users' AND (v.priv='SELECT' OR
  (r.rolname='authenticated' AND v.priv IN ('INSERT','UPDATE'))) AS expected,
 has_column_privilege(r.oid,t.oid,a.attnum,v.priv || ' WITH GRANT OPTION') AS grant_option
 FROM roles r CROSS JOIN tables t JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
 CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) v(priv)
), default_exposures AS (
 SELECT owner.rolname AS creator,k.kind::text AS object_type,a.grantee,a.privilege_type,layer.scope
 FROM pg_roles owner CROSS JOIN (VALUES ('r'::"char"),('S'::"char"),('f'::"char")) k(kind)
 CROSS JOIN LATERAL (
  SELECT 'global' AS scope,coalesce((SELECT d.defaclacl FROM pg_default_acl d
   WHERE d.defaclrole=owner.oid AND d.defaclnamespace=0 AND d.defaclobjtype=k.kind),acldefault(CASE WHEN k.kind='S' THEN 's'::"char" ELSE k.kind END,owner.oid)) AS acl
  UNION ALL
  SELECT 'public',d.defaclacl FROM pg_default_acl d WHERE d.defaclrole=owner.oid
   AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype=k.kind
 ) layer CROSS JOIN LATERAL aclexplode(layer.acl) a
 WHERE owner.rolname IN ('postgres','supabase_admin')
 AND (a.grantee=0 OR a.grantee IN (SELECT oid FROM roles))
), checks AS (
 SELECT 'required_tables_and_roles' AS check_name,(SELECT count(*)=3 FROM tables) AND (SELECT count(*)=2 FROM roles) AS passed
 UNION ALL SELECT 'rls_enabled',coalesce((SELECT bool_and(relrowsecurity) FROM tables),false)
 UNION ALL SELECT 'table_privileges',coalesce((SELECT bool_and(actual=expected AND NOT grant_option) FROM privileges),false)
 UNION ALL SELECT 'column_privileges',coalesce((SELECT bool_and(actual=expected AND NOT grant_option) FROM columns_check),false)
 UNION ALL SELECT 'client_roles_not_elevated',NOT EXISTS (SELECT 1 FROM roles WHERE rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)
 UNION ALL SELECT 'no_unreviewed_role_memberships',NOT EXISTS (SELECT 1 FROM roles r JOIN pg_roles other ON other.oid<>r.oid AND pg_has_role(r.oid,other.oid,'MEMBER'))
 UNION ALL SELECT 'no_schema_create',NOT EXISTS (SELECT 1 FROM roles WHERE has_schema_privilege(oid,'public','CREATE'))
 UNION ALL SELECT 'schema_usage',coalesce((SELECT bool_and(has_schema_privilege(oid,'public','USAGE')) FROM roles),false)
 UNION ALL SELECT 'policies_unchanged_from_audit',
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p
   WHERE schemaname='public' AND tablename IN ('products','store_settings','admin_users'))
  IS NOT DISTINCT FROM $rp_policies$[{"cmd":"DELETE","qual":"( SELECT is_admin() AS is_admin)","roles":["authenticated"],"tablename":"products","permissive":"PERMISSIVE","policyname":"Admin can delete products","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"products","permissive":"PERMISSIVE","policyname":"Admin can insert products","schemaname":"public","with_check":"( SELECT is_admin() AS is_admin)"},{"cmd":"UPDATE","qual":"( SELECT is_admin() AS is_admin)","roles":["authenticated"],"tablename":"products","permissive":"PERMISSIVE","policyname":"Admin can update products","schemaname":"public","with_check":"( SELECT is_admin() AS is_admin)"},{"cmd":"SELECT","qual":"true","roles":["anon","authenticated"],"tablename":"products","permissive":"PERMISSIVE","policyname":"Public can read products","schemaname":"public","with_check":null},{"cmd":"DELETE","qual":"( SELECT is_admin() AS is_admin)","roles":["authenticated"],"tablename":"store_settings","permissive":"PERMISSIVE","policyname":"Admin can delete settings","schemaname":"public","with_check":null},{"cmd":"INSERT","qual":null,"roles":["authenticated"],"tablename":"store_settings","permissive":"PERMISSIVE","policyname":"Admin can insert settings","schemaname":"public","with_check":"( SELECT is_admin() AS is_admin)"},{"cmd":"UPDATE","qual":"( SELECT is_admin() AS is_admin)","roles":["authenticated"],"tablename":"store_settings","permissive":"PERMISSIVE","policyname":"Admin can update settings","schemaname":"public","with_check":"( SELECT is_admin() AS is_admin)"},{"cmd":"SELECT","qual":"true","roles":["anon","authenticated"],"tablename":"store_settings","permissive":"PERMISSIVE","policyname":"Public can read store settings","schemaname":"public","with_check":null}]$rp_policies$::jsonb
 UNION ALL SELECT 'is_admin_body_unchanged',CASE WHEN to_regprocedure('public.is_admin()') IS NULL THEN false
  ELSE replace(pg_get_functiondef(to_regprocedure('public.is_admin()')), E'\r\n', E'\n')=replace(($rp_function$"CREATE OR REPLACE FUNCTION public.is_admin()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO ''\nAS $function$\r\n    SELECT EXISTS (\r\n        SELECT 1\r\n        FROM public.admin_users\r\n        WHERE user_id = (SELECT auth.uid())\r\n    );\r\n$function$\n"$rp_function$::jsonb #>> '{}'), E'\r\n', E'\n') END
 UNION ALL SELECT 'is_admin_owner_and_rls_read_path',EXISTS (SELECT 1 FROM pg_proc p
  JOIN pg_roles owner ON owner.oid=p.proowner
  JOIN pg_class membership ON membership.oid=to_regclass('public.admin_users')
  WHERE p.oid=to_regprocedure('public.is_admin()')
   AND p.prokind='f' AND p.prosecdef AND p.prorettype='boolean'::regtype
   AND owner.rolname='postgres' AND p.proowner=membership.relowner
   AND membership.relrowsecurity
   -- SECURITY DEFINER memakai identitas owner; owner tabel tidak terkena RLS
   -- kecuali FORCE aktif. BYPASSRLS/superuser tetap melewati FORCE.
   AND (owner.rolsuper OR owner.rolbypassrls OR NOT membership.relforcerowsecurity)
   AND has_table_privilege(owner.oid,membership.oid,'SELECT')
   AND has_schema_privilege(owner.oid,'public','USAGE')
   AND has_schema_privilege(owner.oid,'auth','USAGE')
   AND has_function_privilege(owner.oid,'auth.uid()','EXECUTE'))
 UNION ALL SELECT 'authenticated_can_execute_is_admin',CASE WHEN to_regprocedure('public.is_admin()') IS NULL THEN false
  ELSE has_function_privilege('authenticated',to_regprocedure('public.is_admin()'),'EXECUTE') END
 UNION ALL SELECT 'default_creators_exist',(SELECT count(*)=2 FROM pg_roles WHERE rolname IN ('postgres','supabase_admin'))
 UNION ALL SELECT 'default_privileges_hardened_both_creators',NOT EXISTS (SELECT 1 FROM default_exposures)
)
SELECT jsonb_pretty(jsonb_build_object(
 'checks',(SELECT jsonb_agg(to_jsonb(c) ORDER BY check_name) FROM checks c),
 'table_grants_passed',(SELECT bool_and(passed) FROM checks WHERE check_name NOT LIKE 'is_admin_%' AND check_name<>'authenticated_can_execute_is_admin' AND check_name NOT LIKE 'default_%'),
 'is_admin_passed',(SELECT bool_and(passed) FROM checks WHERE check_name LIKE 'is_admin_%' OR check_name='authenticated_can_execute_is_admin'),
 'default_privileges_passed',(SELECT bool_and(passed) FROM checks WHERE check_name LIKE 'default_%'),
 'all_checks_passed',(SELECT bool_and(passed) FROM checks),
 'table_details',(SELECT jsonb_agg(to_jsonb(p) ORDER BY rolname,relname,priv) FROM privileges p),
 'column_mismatches',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) FROM columns_check c WHERE actual IS DISTINCT FROM expected OR grant_option),
 'remaining_default_exposures',(SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) FROM default_exposures d),
 'note','Jika tahap default supabase_admin belum dijalankan, pemeriksaan default tetap false. Ini bukan alasan menambah hak role. Metadata bukan pengganti uji akses pengunjung/non-Admin/Admin.'
)) AS grants_verification;
