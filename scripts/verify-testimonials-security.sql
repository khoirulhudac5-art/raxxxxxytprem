-- READ ONLY. Run manually in the existing project's SQL Editor.
BEGIN READ ONLY;
SELECT pg_get_functiondef(p.oid) AS definition,pg_get_userbyid(p.proowner) AS owner,
 p.prosecdef,p.proconfig,r.rolbypassrls,
 has_table_privilege(p.proowner,'public.admin_users','SELECT') AS helper_can_read_membership
FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
WHERE p.oid='public.is_admin()'::regprocedure;
SELECT r.rolname,r.rolsuper,r.rolbypassrls,
 has_function_privilege(r.oid,'public.is_admin()','EXECUTE') AS can_call_helper,
 has_table_privilege(r.oid,'public.admin_users','INSERT,UPDATE,DELETE,TRUNCATE') AS unexpected_membership_write,
 has_any_column_privilege(r.oid,'public.admin_users','INSERT,UPDATE') AS unexpected_column_write
FROM pg_roles r WHERE r.rolname IN ('anon','authenticated');
SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,
 pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.oid IN ('storage.objects'::regclass,to_regclass('public.testimonials'));
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='testimonials';
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE (schemaname='storage' AND tablename='objects')
 OR (schemaname='public' AND tablename IN ('testimonials','admin_users'))
ORDER BY schemaname,tablename,policyname;
-- NULL means setup has not yet created the table/function.
SELECT has_table_privilege('authenticated',to_regclass('public.testimonials'),'UPDATE') AS lock_via_update,
 has_table_privilege('authenticated',to_regclass('public.testimonials'),'DELETE') AS lock_via_delete,
 has_table_privilege('authenticated',to_regclass('public.testimonials'),'TRUNCATE,MAINTAIN,TRIGGER') AS unexpected_extra_privileges;
SELECT p.prosecdef AS should_be_false,p.proconfig,pg_get_functiondef(p.oid)
FROM pg_proc p WHERE p.oid=to_regprocedure('public.reorder_testimonials(uuid[])');
COMMIT;

