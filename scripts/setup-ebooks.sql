-- REVIEW ONLY: execute manually only AFTER approval, in the EXISTING Supabase SQL Editor.
-- No application changes, paid PDF storage, products or testimonials changes.
-- Atomic, fail-closed installation: a repeat/partial installation raises BEFORE writes.
-- Do not replace this with IF NOT EXISTS/upserts: those can hide schema/security drift.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
 IF to_regclass('public.ebooks') IS NOT NULL
 OR to_regclass('public.ebook_categories') IS NOT NULL
 OR to_regclass('public.ebook_settings') IS NOT NULL
 OR to_regprocedure('public.rakyat_ebook_metadata_v1()') IS NOT NULL
 OR EXISTS (SELECT 1 FROM storage.buckets WHERE id='ebook-images' OR name='ebook-images')
 OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='storage.objects'::regclass
            AND polname LIKE 'ebook_images_%') THEN
  RAISE EXCEPTION 'E-book objects already exist: stop and inspect; never overwrite';
 END IF;
 IF to_regprocedure('public.is_admin()') IS NULL THEN
  RAISE EXCEPTION 'Existing is_admin() required';
 END IF;
 -- Match setup-testimonials.sql and the inspected admin_users-based definition.
 -- Do not trust the name alone and NEVER replace the shared login helper.
 IF NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
  JOIN pg_class c ON c.oid='public.admin_users'::regclass
  JOIN pg_roles owner_role ON owner_role.oid=p.proowner
  WHERE p.oid='public.is_admin()'::regprocedure AND p.prosecdef
  AND p.prorettype='boolean'::regtype AND p.provolatile='s' AND l.lanname='sql'
  AND (p.proconfig=ARRAY['search_path=""']::text[] OR p.proconfig=ARRAY['search_path=']::text[])
  AND regexp_replace(lower(p.prosrc),'\s','','g')=
      regexp_replace(lower($expected$SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid()));$expected$),'\s','','g')
  AND has_table_privilege(p.proowner,c.oid,'SELECT')
  AND (owner_role.rolbypassrls OR owner_role.rolsuper
       OR (c.relowner=p.proowner AND NOT c.relforcerowsecurity))
 ) THEN RAISE EXCEPTION 'is_admin definition/security differs from inspected baseline'; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND
  (r.rolsuper OR r.rolbypassrls
   OR NOT has_function_privilege(r.oid,'public.is_admin()','EXECUTE')
   OR has_table_privilege(r.oid,'public.admin_users','INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_any_column_privilege(r.oid,'public.admin_users','INSERT,UPDATE'))) THEN
  RAISE EXCEPTION 'Client role/admin membership privileges differ from baseline';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
  RAISE EXCEPTION 'Storage objects RLS must already be enabled';
 END IF;
END $preflight$;

-- Verify every pre-existing policy remains byte-for-byte unchanged, not just its name.
CREATE TEMP TABLE ebook_policies_before ON COMMIT DROP AS
 SELECT oid,to_jsonb(p) AS definition FROM pg_policy p;

CREATE TABLE public.ebook_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (length(slug)<=120 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 is_active boolean NOT NULL DEFAULT true,
 sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order>=0),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ebooks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (length(slug)<=160 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
 description text NOT NULL DEFAULT '' CHECK (length(description)<=12000),
 category_id uuid NOT NULL REFERENCES public.ebook_categories(id) ON DELETE RESTRICT,
 -- Relative paths in ebook-images; no arbitrary URL or paid content here.
 cover_path text CHECK (cover_path ~ '^covers/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'),
 is_free boolean NOT NULL DEFAULT true,
 price bigint NOT NULL DEFAULT 0,
 free_download_url text,
 is_published boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order>=0),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ebooks_price_valid CHECK (
  (is_free AND price=0) OR (NOT is_free AND price BETWEEN 1 AND 999999999999)
 ),
 -- Paid rows cannot contain a download URL, even in an Admin response.
 CONSTRAINT ebooks_download_free_only CHECK (is_free OR free_download_url IS NULL),
 CONSTRAINT ebooks_download_https CHECK (free_download_url IS NULL OR (
  length(free_download_url)<=2048
  AND free_download_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$'
 )),
 CONSTRAINT ebooks_published_ready CHECK (
  NOT is_published OR (cover_path IS NOT NULL AND (NOT is_free OR free_download_url IS NOT NULL))
 )
);
CREATE TABLE public.ebook_settings (
 id text PRIMARY KEY DEFAULT 'main' CHECK (id='main'),
 banner_path text CHECK (banner_path ~ '^banners/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'),
 banner_alt text NOT NULL DEFAULT '' CHECK (length(banner_alt)<=200),
 banner_enabled boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT ebook_banner_ready CHECK (NOT banner_enabled OR
  (banner_path IS NOT NULL AND length(btrim(banner_alt))>0))
);
CREATE INDEX ebooks_display_order ON public.ebooks(sort_order,created_at,id) WHERE is_published;
CREATE INDEX ebooks_category ON public.ebooks(category_id);
CREATE INDEX ebook_categories_display_order ON public.ebook_categories(sort_order,id);

-- App UPDATE/DELETE MUST filter by id AND expected revision, then require one row.
-- Trigger owns revision/timestamps; it does not replace the optimistic WHERE clause.
-- Slugs and IDs are immutable, so changing a title never breaks its public URL.
CREATE FUNCTION public.rakyat_ebook_metadata_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $metadata$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.revision := 1;
  NEW.created_at := pg_catalog.clock_timestamp();
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'ID is immutable'; END IF;
  IF TG_TABLE_NAME IN ('ebooks','ebook_categories') THEN
   IF NEW.slug IS DISTINCT FROM OLD.slug THEN RAISE EXCEPTION 'Slug is immutable'; END IF;
  END IF;
  NEW.revision := OLD.revision + 1;
  NEW.created_at := OLD.created_at;
 END IF;
 NEW.updated_at := pg_catalog.clock_timestamp();
 RETURN NEW;
END $metadata$;
REVOKE ALL ON FUNCTION public.rakyat_ebook_metadata_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ebooks_metadata BEFORE INSERT OR UPDATE ON public.ebooks
 FOR EACH ROW EXECUTE FUNCTION public.rakyat_ebook_metadata_v1();
CREATE TRIGGER ebook_categories_metadata BEFORE INSERT OR UPDATE ON public.ebook_categories
 FOR EACH ROW EXECUTE FUNCTION public.rakyat_ebook_metadata_v1();
CREATE TRIGGER ebook_settings_metadata BEFORE INSERT OR UPDATE ON public.ebook_settings
 FOR EACH ROW EXECUTE FUNCTION public.rakyat_ebook_metadata_v1();

ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebook_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebook_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ebooks,public.ebook_categories,public.ebook_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ebooks,public.ebook_categories,public.ebook_settings TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.ebooks,public.ebook_categories,public.ebook_settings TO authenticated;

CREATE POLICY ebooks_read ON public.ebooks FOR SELECT TO anon,authenticated
 USING ((SELECT public.is_admin()) OR (is_published AND EXISTS (
  SELECT 1 FROM public.ebook_categories c WHERE c.id=category_id AND c.is_active)));
CREATE POLICY ebooks_insert ON public.ebooks FOR INSERT TO authenticated
 WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY ebooks_update ON public.ebooks FOR UPDATE TO authenticated
 USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY ebooks_delete ON public.ebooks FOR DELETE TO authenticated
 USING ((SELECT public.is_admin()));
CREATE POLICY ebook_categories_read ON public.ebook_categories FOR SELECT TO anon,authenticated
 USING (is_active OR (SELECT public.is_admin()));
CREATE POLICY ebook_categories_insert ON public.ebook_categories FOR INSERT TO authenticated
 WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY ebook_categories_update ON public.ebook_categories FOR UPDATE TO authenticated
 USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY ebook_categories_delete ON public.ebook_categories FOR DELETE TO authenticated
 USING ((SELECT public.is_admin()));
CREATE POLICY ebook_settings_read ON public.ebook_settings FOR SELECT TO anon,authenticated
 USING (banner_enabled OR (SELECT public.is_admin()));
CREATE POLICY ebook_settings_insert ON public.ebook_settings FOR INSERT TO authenticated
 WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY ebook_settings_update ON public.ebook_settings FOR UPDATE TO authenticated
 USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY ebook_settings_delete ON public.ebook_settings FOR DELETE TO authenticated
 USING ((SELECT public.is_admin()));

INSERT INTO public.ebook_categories(slug,name,sort_order) VALUES
 ('edukasi-pembelajaran','Edukasi & Pembelajaran',10),
 ('tutorial-panduan-aplikasi','Tutorial & Panduan Aplikasi',20),
 ('bisnis-marketing','Bisnis & Marketing',30),
 ('desain-kreativitas','Desain & Kreativitas',40),
 ('teknologi-ai','Teknologi & AI',50),
 ('keuangan-produktivitas','Keuangan & Produktivitas',60),
 ('pengembangan-diri','Pengembangan Diri',70);
INSERT INTO public.ebook_settings(id) VALUES ('main');

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('ebook-images','ebook-images',true,5242880,ARRAY['image/png','image/jpeg','image/webp']);
-- Public delivery is intentional; NEVER upload PDFs, secrets or paid files here.
-- Admin SELECT supports listing/update/delete. Public delivery needs no list policy.
CREATE POLICY ebook_images_admin_read ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='ebook-images' AND (SELECT public.is_admin()));
CREATE POLICY ebook_images_admin_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='ebook-images' AND (SELECT public.is_admin())
  AND name ~ '^(covers|banners)/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$');
CREATE POLICY ebook_images_admin_update ON storage.objects FOR UPDATE TO authenticated
 USING (bucket_id='ebook-images' AND (SELECT public.is_admin()))
 WITH CHECK (bucket_id='ebook-images' AND (SELECT public.is_admin())
  AND name ~ '^(covers|banners)/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$');
CREATE POLICY ebook_images_admin_delete ON storage.objects FOR DELETE TO authenticated
 USING (bucket_id='ebook-images' AND (SELECT public.is_admin()));
-- PERMISSIVE policies combine with OR; guards prevent old broad policies bypassing Admin.
-- TRUE for every other bucket, preserving testimonials/product-images restrictions.
CREATE POLICY ebook_images_select_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING (bucket_id<>'ebook-images' OR (SELECT public.is_admin()));
CREATE POLICY ebook_images_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK (bucket_id<>'ebook-images' OR ((SELECT public.is_admin())
  AND name ~ '^(covers|banners)/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'));
CREATE POLICY ebook_images_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING (bucket_id<>'ebook-images' OR (SELECT public.is_admin()))
 WITH CHECK (bucket_id<>'ebook-images' OR ((SELECT public.is_admin())
  AND name ~ '^(covers|banners)/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'));
CREATE POLICY ebook_images_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
 USING (bucket_id<>'ebook-images' OR (SELECT public.is_admin()));

-- Use the Storage API, never SQL DELETE on storage.objects (which leaves orphan blobs).
-- Future app: upload a fresh UUID with upsert:false, save DB reference using revision,
-- then delete only detached files not used by ANY ebook/banner. No deletion is run here.
-- RLS reference chain is ebooks -> ebook_categories -> is_admin -> admin_users;
-- it never loops into storage.objects. Storage policies call is_admin only.
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.ebook_categories)<>7
 OR (SELECT count(*) FROM public.ebooks)<>0
 OR (SELECT count(*) FROM public.ebook_settings WHERE id='main' AND NOT banner_enabled AND revision=1)<>1
 OR EXISTS (SELECT 1 FROM public.ebook_categories WHERE revision<>1) THEN
  RAISE EXCEPTION 'Unexpected e-book initial state';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='ebook-images' AND public
  AND file_size_limit=5242880
  AND allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp']) THEN
  RAISE EXCEPTION 'Unexpected e-book bucket configuration';
 END IF;
 IF EXISTS (
  (SELECT oid,definition FROM pg_temp.ebook_policies_before EXCEPT ALL
   SELECT p.oid,to_jsonb(p) FROM pg_policy p JOIN pg_temp.ebook_policies_before b ON b.oid=p.oid)
  UNION ALL
  (SELECT p.oid,to_jsonb(p) FROM pg_policy p JOIN pg_temp.ebook_policies_before b ON b.oid=p.oid
   EXCEPT ALL SELECT oid,definition FROM pg_temp.ebook_policies_before)
 ) THEN RAISE EXCEPTION 'An existing policy changed or disappeared'; END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
COMMIT;
-- Success only after COMMIT. Any error aborts the entire transaction; do not run fragments.
-- If using a persistent SQL session after an error, issue ROLLBACK before retrying.
-- Post-approval verification: inspect 7 categories, 0 ebooks, disabled banner, bucket;
-- test anon/non-admin/admin identities and revision conflicts before wiring the UI.
