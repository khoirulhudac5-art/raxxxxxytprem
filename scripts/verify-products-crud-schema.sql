-- READ ONLY; use after a STAGING migration has been explicitly committed.
BEGIN READ ONLY;
-- Initial-state verifier: run before any CRUD test. revision=1 is not expected later.
WITH expected(id,position) AS (
 VALUES ('chatgpt',10),('capcut',20),('canva',30),('google',40),
 ('youtube',50),('spotify',60),('zoom',70)
), effective_grants AS (
 SELECT has_table_privilege(r.oid,t.id,priv.name) =
  (t.id <> 'public.admin_users'::regclass AND
   (priv.name='SELECT' OR (r.rolname='authenticated' AND priv.name IN ('INSERT','UPDATE','DELETE')))) AS passed
 FROM pg_roles AS r CROSS JOIN
 (VALUES ('public.products'::regclass),('public.store_settings'::regclass),('public.admin_users'::regclass)) AS t(id)
 CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) AS priv(name)
 WHERE r.rolname IN ('anon','authenticated')
), policy_checks AS (
 SELECT pol.tablename,pol.cmd,
 CASE WHEN pol.cmd='SELECT' THEN
  pol.roles::text[] @> ARRAY['anon','authenticated']::text[] AND cardinality(pol.roles)=2 AND pol.qual='true'
 ELSE pol.roles::text[]=ARRAY['authenticated']::text[] AND
  (pol.cmd='INSERT' OR regexp_replace(lower(pol.qual),'\s','','g')='(selectis_admin()asis_admin)') AND
  (pol.cmd='DELETE' OR regexp_replace(lower(pol.with_check),'\s','','g')='(selectis_admin()asis_admin)')
 END AND pol.permissive='PERMISSIVE' AS passed
 FROM pg_policies AS pol WHERE pol.schemaname='public'
 AND pol.tablename IN ('products','store_settings','admin_users')
)
SELECT jsonb_build_object(
 'initial_order_passed',NOT EXISTS (SELECT 1 FROM public.products AS p FULL JOIN expected AS e USING(id)
  WHERE p.id IS NULL OR e.id IS NULL OR p.sort_order IS DISTINCT FROM e.position),
 'initial_revision_passed',(SELECT count(*)=7 AND bool_and(revision=1) FROM public.products),
 'counts_passed',(SELECT count(*)=7 AND sum(CASE WHEN jsonb_typeof(plans)='array'
  THEN jsonb_array_length(plans) ELSE 0 END)=14 AND bool_and(jsonb_typeof(plans)='array') FROM public.products),
 'rls_passed',(SELECT count(*)=3 AND bool_and(relrowsecurity) FROM pg_class WHERE oid IN
  ('public.products'::regclass,'public.store_settings'::regclass,'public.admin_users'::regclass)),
 'table_grants_passed',(SELECT count(*)=48 AND bool_and(passed) FROM effective_grants),
 'policies_passed',(SELECT count(*)=8 AND count(DISTINCT (tablename,cmd))=8 AND bool_and(coalesce(passed,false))
  AND bool_and(tablename IN ('products','store_settings') AND cmd IN ('SELECT','INSERT','UPDATE','DELETE')) FROM policy_checks),
 'trigger_passed',(SELECT count(*)=1 AND bool_and(tgname='rakyat_products_metadata_v1' AND tgenabled='O'
  AND tgtype=23 AND tgfoid='public.rakyat_products_metadata_v1()'::regprocedure)
  FROM pg_trigger WHERE tgrelid='public.products'::regclass AND NOT tgisinternal),
 'trigger_function_passed',(SELECT NOT prosecdef AND prorettype='trigger'::regtype
  AND proconfig=ARRAY['search_path=""']::text[] FROM pg_proc WHERE oid='public.rakyat_products_metadata_v1()'::regprocedure),
 'trigger_execute_restricted',NOT EXISTS (SELECT 1 FROM pg_roles AS r
  WHERE r.rolname IN ('anon','authenticated') AND has_function_privilege(r.oid,'public.rakyat_products_metadata_v1()','EXECUTE'))
) AS initial_crud_schema_checks;
-- Also inspect details below and use the full grants verifier for effective column
-- privileges, is_admin, and separate default-privilege results. No default failure
-- should be reported as a table-grant failure.
SELECT id,sort_order,revision,updated_at,jsonb_array_length(plans) AS packages
FROM public.products ORDER BY sort_order,id;
SELECT count(*) AS products,sum(jsonb_array_length(plans)) AS packages,
 bool_and(revision > 0 AND sort_order >= 0) AS valid_metadata FROM public.products;
SELECT pg_get_triggerdef(oid) AS trigger_definition FROM pg_trigger
WHERE tgrelid='public.products'::regclass AND NOT tgisinternal;
SELECT p.proname,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid)
FROM pg_proc AS p WHERE p.oid='public.rakyat_products_metadata_v1()'::regprocedure;
SELECT role_entry.rolname,
 has_function_privilege(role_entry.oid,'public.rakyat_products_metadata_v1()','EXECUTE') AS unexpected_execute
FROM pg_roles AS role_entry WHERE role_entry.rolname IN ('anon','authenticated');
SELECT role_entry.rolname,privilege_entry.name,
 has_table_privilege(role_entry.oid,'public.products',privilege_entry.name) AS allowed
FROM pg_roles AS role_entry CROSS JOIN
 (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) AS privilege_entry(name)
WHERE role_entry.rolname IN ('anon','authenticated');
SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('products','store_settings','admin_users');
SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
WHERE oid IN ('public.products'::regclass,'public.store_settings'::regclass,'public.admin_users'::regclass);
-- Also run verify-supabase-grants.sql: table/function/default checks stay separate.
-- Compare snapshot-supabase-acl.sql before/after; no table/column ACL changes expected.
COMMIT;
