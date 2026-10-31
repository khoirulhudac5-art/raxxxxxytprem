-- REVIEW BEFORE EXECUTION. Existing Supabase project only; not executed by the app.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='product-images') THEN
  RAISE EXCEPTION 'product-images already exists; inspect instead of overwriting';
 END IF;
 IF to_regprocedure('public.is_admin()') IS NULL THEN RAISE EXCEPTION 'Existing is_admin helper required'; END IF;
 -- Match the inspected helper body, not merely its name. Never replace it here.
 IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
  JOIN pg_class c ON c.oid='public.admin_users'::regclass
  JOIN pg_roles owner_role ON owner_role.oid=p.proowner
  WHERE p.oid='public.is_admin()'::regprocedure AND p.prosecdef
  AND p.prorettype='boolean'::regtype AND p.provolatile='s' AND l.lanname='sql'
  AND (p.proconfig=ARRAY['search_path=""']::text[] OR p.proconfig=ARRAY['search_path=']::text[])
  AND regexp_replace(lower(p.prosrc),'\s','','g')=
      regexp_replace(lower($expected$SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid()));$expected$),'\s','','g')
  AND has_table_privilege(p.proowner,c.oid,'SELECT')
  AND (owner_role.rolbypassrls OR owner_role.rolsuper OR (c.relowner=p.proowner AND NOT c.relforcerowsecurity))) THEN
  RAISE EXCEPTION 'is_admin definition/security differs from inspected baseline; stop for review';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND
  (r.rolsuper OR r.rolbypassrls OR
   NOT has_function_privilege(r.oid,'public.is_admin()','EXECUTE') OR
   has_table_privilege(r.oid,'public.admin_users','INSERT,UPDATE,DELETE,TRUNCATE') OR
   has_any_column_privilege(r.oid,'public.admin_users','INSERT,UPDATE'))) THEN
  RAISE EXCEPTION 'Client role/helper/admin membership privileges differ from expected baseline';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN RAISE EXCEPTION 'Storage RLS must be enabled'; END IF;
END $$;
-- Preserve every existing Storage policy, including all testimonials policies.
CREATE TEMP TABLE product_images_policies_before ON COMMIT DROP AS
 SELECT oid,to_jsonb(p) AS definition FROM pg_policy p WHERE polrelid='storage.objects'::regclass;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('product-images','product-images',true,5242880,ARRAY['image/png','image/jpeg','image/webp']);
-- Public object delivery is intentional. No private customer screenshots belong here.
CREATE POLICY product_images_admin_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='product-images' AND (SELECT public.is_admin()));
CREATE POLICY product_images_admin_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='product-images' AND (SELECT public.is_admin())
  AND name ~ '^[0-9a-f-]{36}\.(png|jpg|webp)$');
-- Physical deletion is disabled for application sessions, even for Admin.
-- Detaching/replacing a product image only changes its reference after Save.
-- Restrictive guards prevent broad pre-existing permissive policies from bypassing
-- this bucket's rules. They are TRUE for testimonials and every other bucket.
CREATE POLICY product_images_select_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(bucket_id<>'product-images' OR (SELECT public.is_admin()));
CREATE POLICY product_images_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK(bucket_id<>'product-images' OR ((SELECT public.is_admin()) AND name ~ '^[0-9a-f-]{36}\.(png|jpg|webp)$'));
CREATE POLICY product_images_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id<>'product-images') WITH CHECK(bucket_id<>'product-images');
CREATE POLICY product_images_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
 USING(bucket_id<>'product-images');
DO $$ BEGIN
 IF EXISTS(
  (SELECT oid,definition FROM pg_temp.product_images_policies_before EXCEPT ALL
   SELECT p.oid,to_jsonb(p) FROM pg_policy p JOIN pg_temp.product_images_policies_before b ON b.oid=p.oid)
  UNION ALL
  (SELECT p.oid,to_jsonb(p) FROM pg_policy p JOIN pg_temp.product_images_policies_before b ON b.oid=p.oid
   EXCEPT ALL SELECT oid,definition FROM pg_temp.product_images_policies_before)
 ) THEN RAISE EXCEPTION 'Existing Storage policy changed'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
