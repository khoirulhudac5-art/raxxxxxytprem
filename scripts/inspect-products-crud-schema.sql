-- READ ONLY. Run manually before reviewing the migration, and again in staging.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_setting('server_version') AS postgres_version;
SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns WHERE table_schema='public'
 AND table_name IN ('products','store_settings') ORDER BY table_name,ordinal_position;
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
FROM pg_class AS c WHERE c.oid IN ('public.products'::regclass,'public.store_settings'::regclass,'public.admin_users'::regclass);
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('products','store_settings','admin_users');
SELECT tgname,pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgrelid='public.products'::regclass AND NOT tgisinternal;
SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.products'::regclass;
SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='products';
SELECT pg_describe_object(classid,objid,objsubid) AS dependent_object,deptype
FROM pg_depend WHERE refclassid='pg_class'::regclass AND refobjid='public.products'::regclass;
SELECT count(*) AS products,sum(jsonb_array_length(plans)) AS plans FROM public.products;
SELECT p.proname,pg_get_functiondef(p.oid) AS definition,p.prosecdef,
 pg_get_userbyid(p.proowner) AS owner,p.proconfig,p.proacl
FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('is_admin','rakyat_products_metadata_v1');
COMMIT;
