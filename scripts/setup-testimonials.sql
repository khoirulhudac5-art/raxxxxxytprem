-- REVIEW BEFORE EXECUTION. Not applied by the application.
-- Run once in SQL Editor of the EXISTING Supabase project after approval.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regclass('public.testimonials') IS NOT NULL OR EXISTS(SELECT 1 FROM storage.buckets WHERE id='testimonials') THEN
  RAISE EXCEPTION 'Testimonials table/bucket already exists; inspect instead of overwriting';
 END IF;
 IF to_regprocedure('public.is_admin()') IS NULL THEN RAISE EXCEPTION 'Existing is_admin() required'; END IF;
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
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
  RAISE EXCEPTION 'Storage objects RLS must already be enabled';
 END IF;
END $$;
CREATE TEMP TABLE testimonials_storage_policies_before ON COMMIT DROP AS
 SELECT oid,to_jsonb(p) AS definition FROM pg_policy p WHERE polrelid='storage.objects'::regclass;
CREATE TABLE public.testimonials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 image_url text NOT NULL,
 storage_path text NOT NULL UNIQUE CHECK (storage_path ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'),
 sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 is_published boolean NOT NULL DEFAULT false
);
CREATE INDEX testimonials_display_order ON public.testimonials(sort_order,created_at,id);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.testimonials FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.testimonials TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.testimonials TO authenticated;
CREATE POLICY testimonials_read ON public.testimonials FOR SELECT TO anon,authenticated
 USING(is_published OR (SELECT public.is_admin()));
CREATE POLICY testimonials_insert ON public.testimonials FOR INSERT TO authenticated
 WITH CHECK((SELECT public.is_admin()));
CREATE POLICY testimonials_update ON public.testimonials FOR UPDATE TO authenticated
 USING((SELECT public.is_admin())) WITH CHECK((SELECT public.is_admin()));
CREATE POLICY testimonials_delete ON public.testimonials FOR DELETE TO authenticated
 USING((SELECT public.is_admin()));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('testimonials','testimonials',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
CREATE POLICY testimonials_storage_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='testimonials' AND ((SELECT public.is_admin()) OR EXISTS(
  SELECT 1 FROM public.testimonials t WHERE t.storage_path=storage.objects.name AND t.is_published)));
CREATE POLICY testimonials_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='testimonials' AND (SELECT public.is_admin()) AND name ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$');
CREATE POLICY testimonials_storage_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='testimonials' AND (SELECT public.is_admin()));
-- No storage UPDATE permission: uploads never overwrite an existing object.
-- Existing PERMISSIVE storage policies combine with OR. These RESTRICTIVE guards
-- prevent broad legacy policies from granting access to this new bucket.
-- Every guard is TRUE for other buckets: their existing access is unchanged.
CREATE POLICY testimonials_storage_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(bucket_id<>'testimonials' OR (SELECT public.is_admin()) OR EXISTS(
  SELECT 1 FROM public.testimonials t WHERE t.storage_path=storage.objects.name AND t.is_published));
CREATE POLICY testimonials_storage_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK(bucket_id<>'testimonials' OR ((SELECT public.is_admin()) AND name ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'));
CREATE POLICY testimonials_storage_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id<>'testimonials') WITH CHECK(bucket_id<>'testimonials');
CREATE POLICY testimonials_storage_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
 USING(bucket_id<>'testimonials' OR (SELECT public.is_admin()));
CREATE FUNCTION public.reorder_testimonials(ordered_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE affected bigint;
BEGIN
 IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Admin required'; END IF;
 -- PostgreSQL 17 permits this lock with table-level UPDATE or DELETE already
 -- granted above. No ownership, MAINTAIN, TRUNCATE or SECURITY DEFINER is needed.
 -- RLS still controls the subsequent SELECT and UPDATE as the calling Admin.
 LOCK TABLE public.testimonials IN SHARE ROW EXCLUSIVE MODE;
 IF ordered_ids IS NULL OR array_position(ordered_ids,NULL) IS NOT NULL OR
  coalesce(array_ndims(ordered_ids),1)<>1 OR coalesce(array_lower(ordered_ids,1),1)<>1 OR
  cardinality(ordered_ids)<>(SELECT count(*) FROM public.testimonials) OR
  cardinality(ordered_ids)<>(SELECT count(DISTINCT x) FROM unnest(ordered_ids) x) OR
  EXISTS(SELECT 1 FROM unnest(ordered_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.testimonials t WHERE t.id=x)) THEN
  RAISE EXCEPTION 'List changed; refresh before reordering';
 END IF;
 UPDATE public.testimonials t SET sort_order=(u.position*10)::integer
 FROM unnest(ordered_ids) WITH ORDINALITY AS u(id,position) WHERE t.id=u.id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>cardinality(ordered_ids) THEN
  RAISE EXCEPTION 'Reorder incomplete or denied by RLS; transaction rolled back';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.reorder_testimonials(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_testimonials(uuid[]) TO authenticated;
DO $$ BEGIN
 IF NOT has_table_privilege('authenticated','public.testimonials','UPDATE') OR
    NOT has_table_privilege('authenticated','public.testimonials','DELETE') OR
    has_table_privilege('authenticated','public.testimonials','TRUNCATE,MAINTAIN,TRIGGER') THEN
  RAISE EXCEPTION 'Unexpected testimonial table privileges';
 END IF;
 IF EXISTS (
  (SELECT oid,definition FROM pg_temp.testimonials_storage_policies_before
   EXCEPT ALL SELECT p.oid,to_jsonb(p) FROM pg_policy p
   JOIN pg_temp.testimonials_storage_policies_before b ON b.oid=p.oid)
  UNION ALL
  (SELECT p.oid,to_jsonb(p) FROM pg_policy p
   JOIN pg_temp.testimonials_storage_policies_before b ON b.oid=p.oid
   EXCEPT ALL SELECT oid,definition FROM pg_temp.testimonials_storage_policies_before)
 ) THEN RAISE EXCEPTION 'An existing Storage policy changed'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
