-- READ ONLY. Run SECTION A first in the SQL Editor of the project where setup ran.
-- No INSERT/UPDATE/DELETE/DDL, role changes, sessions, tokens, or account contents.
-- If any table exists=false, STOP and share SECTION A; do NOT rerun setup blindly.
-- Run SECTION B separately only if all three tables exist in SECTION A.

-- SECTION A: catalog metadata. Works even if the e-book tables are absent.
WITH expected_tables(name) AS (
 VALUES ('ebooks'),('ebook_categories'),('ebook_settings')
), targets AS (
 SELECT e.name,c.oid,c.relrowsecurity,c.relforcerowsecurity,c.relowner,c.relacl
 FROM expected_tables e
 LEFT JOIN pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.name AND c.relkind IN ('r','p')
), policies AS (
 SELECT n.nspname AS schema_name,c.relname AS table_name,p.polname AS policy_name,
  p.polpermissive AS permissive,
  ARRAY(SELECT CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END FROM unnest(p.polroles) r) AS roles,
  p.polcmd AS command,pg_get_expr(p.polqual,p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE (n.nspname='public' AND c.relname IN ('ebooks','ebook_categories','ebook_settings'))
 OR (n.nspname='storage' AND c.relname='objects')
), functions AS (
 SELECT p.oid,p.proname,pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,p.proconfig AS settings,
  pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='public' AND p.proname IN ('is_admin','rakyat_ebook_metadata_v1') AND p.pronargs=0)
 OR (n.nspname='auth' AND p.proname='uid' AND p.pronargs=0)
)
SELECT jsonb_build_object(
 'tables', (SELECT jsonb_agg(jsonb_build_object(
  'name',name,'exists',oid IS NOT NULL,'rls_enabled',relrowsecurity,
  'force_rls',relforcerowsecurity,'owner',pg_get_userbyid(relowner)) ORDER BY name) FROM targets),
 'role_privileges', (SELECT jsonb_agg(jsonb_build_object(
  'table',t.name,'role',r.rolname,'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,
  'select',has_table_privilege(r.oid,t.oid,'SELECT'),
  'insert',has_table_privilege(r.oid,t.oid,'INSERT'),
  'update',has_table_privilege(r.oid,t.oid,'UPDATE'),
  'delete',has_table_privilege(r.oid,t.oid,'DELETE'),
  'truncate',has_table_privilege(r.oid,t.oid,'TRUNCATE'),
  'is_admin_execute',has_function_privilege(r.oid,to_regprocedure('public.is_admin()'),'EXECUTE')
 ) ORDER BY t.name,r.rolname) FROM targets t CROSS JOIN pg_roles r
 WHERE t.oid IS NOT NULL AND r.rolname IN ('anon','authenticated')),
 'constraints',coalesce((SELECT jsonb_agg(jsonb_build_object(
  'table',t.name,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY t.name,c.conname)
  FROM targets t JOIN pg_constraint c ON c.conrelid=t.oid),'[]'::jsonb),
 'triggers',coalesce((SELECT jsonb_agg(pg_get_triggerdef(g.oid) ORDER BY t.name,g.tgname)
  FROM targets t JOIN pg_trigger g ON g.tgrelid=t.oid WHERE NOT g.tgisinternal),'[]'::jsonb),
 'bucket',coalesce((SELECT jsonb_agg(jsonb_build_object(
  'id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types))
  FROM storage.buckets WHERE id='ebook-images'),'[]'::jsonb),
 'storage_rls_enabled',(SELECT c.relrowsecurity FROM pg_class c WHERE c.oid=to_regclass('storage.objects')),
 'policies',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY schema_name,table_name,policy_name) FROM policies p),'[]'::jsonb),
 'functions',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY proname) FROM functions f),'[]'::jsonb)
) AS ebook_security_verification;

-- SECTION B: initial data. Run only after SECTION A confirms all three tables exist.
-- Expected: 7 exact active categories, 0 ebooks, one main banner disabled at revision 1.
WITH expected(slug,name,sort_order) AS (
 VALUES
 ('edukasi-pembelajaran','Edukasi & Pembelajaran',10),
 ('tutorial-panduan-aplikasi','Tutorial & Panduan Aplikasi',20),
 ('bisnis-marketing','Bisnis & Marketing',30),
 ('desain-kreativitas','Desain & Kreativitas',40),
 ('teknologi-ai','Teknologi & AI',50),
 ('keuangan-produktivitas','Keuangan & Produktivitas',60),
 ('pengembangan-diri','Pengembangan Diri',70)
), differences AS (
 SELECT coalesce(e.slug,c.slug) AS slug,
  e.slug IS NULL AS unexpected_category,c.slug IS NULL AS missing_category,
  c.name IS DISTINCT FROM e.name AS name_differs,
  c.sort_order IS DISTINCT FROM e.sort_order AS order_differs,
  c.is_active IS DISTINCT FROM true AS inactive,
  c.revision IS DISTINCT FROM 1 AS revision_differs
 FROM expected e FULL JOIN public.ebook_categories c USING(slug)
 WHERE e.slug IS NULL OR c.slug IS NULL OR c.name IS DISTINCT FROM e.name
 OR c.sort_order IS DISTINCT FROM e.sort_order OR c.is_active IS DISTINCT FROM true
 OR c.revision IS DISTINCT FROM 1
)
SELECT jsonb_build_object(
 'category_count',(SELECT count(*) FROM public.ebook_categories),
 'categories',(SELECT jsonb_agg(jsonb_build_object('slug',slug,'name',name,
  'sort_order',sort_order,'is_active',is_active,'revision',revision) ORDER BY sort_order,slug)
  FROM public.ebook_categories),
 'category_differences',coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM differences d),'[]'::jsonb),
 'categories_initial_state_passed',NOT EXISTS(SELECT 1 FROM differences),
 'ebook_count',(SELECT count(*) FROM public.ebooks),
 'settings_count',(SELECT count(*) FROM public.ebook_settings),
 'settings',(SELECT jsonb_agg(jsonb_build_object('id',id,'banner_enabled',banner_enabled,
  'banner_path',banner_path,'revision',revision)) FROM public.ebook_settings),
 'banner_initial_state_passed',(
  (SELECT count(*) FROM public.ebook_settings)=1 AND EXISTS(
   SELECT 1 FROM public.ebook_settings WHERE id='main' AND NOT banner_enabled
   AND banner_path IS NULL AND revision=1))
) AS ebook_initial_data_verification;
