-- DRAFT / STAGING FIRST. Not approved for production execution.
-- Read CRUD-STAGING-PREPARATION.md and inspect current metadata first.
-- Ends ROLLBACK deliberately. COMMIT requires separate approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.products IN ACCESS EXCLUSIVE MODE;
-- Prevent concurrent DDL/DML on security-related tables during the comparison.
LOCK TABLE public.store_settings, public.admin_users IN SHARE MODE;

CREATE TEMP VIEW rakyat_security_current AS
 SELECT jsonb_build_object(
  'tables',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'owner',c.relowner,
   'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text) ORDER BY c.oid)
   FROM pg_class AS c WHERE c.oid IN ('public.products'::regclass,'public.store_settings'::regclass,'public.admin_users'::regclass)),
  'policies',(SELECT coalesce(jsonb_agg(to_jsonb(pol) ORDER BY pol.tablename,pol.policyname),'[]'::jsonb)
   FROM pg_policies AS pol WHERE pol.schemaname='public' AND pol.tablename IN ('products','store_settings','admin_users')),
  'column_acl',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',a.attrelid,'column',a.attname,'acl',a.attacl::text)
   ORDER BY a.attrelid,a.attnum),'[]'::jsonb) FROM pg_attribute AS a
   WHERE a.attrelid IN ('public.products'::regclass,'public.store_settings'::regclass,'public.admin_users'::regclass)
   AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL),
  'is_admin',pg_get_functiondef('public.is_admin()'::regprocedure),
  'is_admin_acl',(SELECT proacl::text FROM pg_proc WHERE oid='public.is_admin()'::regprocedure)
 ) AS state;
CREATE TEMP TABLE rakyat_security_before ON COMMIT DROP AS SELECT state FROM rakyat_security_current;

DO $preflight$
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.products'::regclass) THEN
  RAISE EXCEPTION 'Products RLS must be enabled';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.products'::regclass
  AND attname IN ('sort_order','revision') AND NOT attisdropped)
  OR to_regprocedure('public.rakyat_products_metadata_v1()') IS NOT NULL THEN
  RAISE EXCEPTION 'Migration objects already exist: inspect, do not overwrite';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.products'::regclass AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'Unexpected trigger: dependency review required';
 END IF;
 IF (SELECT count(*) FROM public.products) <> 7 OR
  (SELECT count(*) FROM public.products WHERE id IN
   ('chatgpt','capcut','canva','google','youtube','spotify','zoom')) <> 7 THEN
  RAISE EXCEPTION 'Expected exactly the approved seven IDs';
 END IF;
 IF EXISTS (SELECT 1 FROM public.products WHERE jsonb_typeof(plans) IS DISTINCT FROM 'array') THEN
  RAISE EXCEPTION 'Invalid plans JSON type';
 END IF;
 IF (SELECT sum(jsonb_array_length(plans)) FROM public.products) <> 14 THEN
  RAISE EXCEPTION 'Expected fourteen packages';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_class WHERE oid IN ('public.products'::regclass,
  'public.store_settings'::regclass,'public.admin_users'::regclass) AND NOT relrowsecurity) THEN
  RAISE EXCEPTION 'All target tables must have RLS enabled';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.products'::regclass
  AND attname='updated_at' AND NOT attisdropped AND atttypid <> 'timestamptz'::regtype) OR
  NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.products'::regclass
   AND attname='updated_at' AND NOT attisdropped) THEN
  RAISE EXCEPTION 'updated_at schema mismatch';
 END IF;
END
$preflight$;

CREATE TEMP TABLE rakyat_products_before ON COMMIT DROP AS
 SELECT id, to_jsonb(p) AS row_data FROM public.products AS p;

ALTER TABLE public.products ADD COLUMN sort_order integer;
ALTER TABLE public.products ADD COLUMN revision integer NOT NULL DEFAULT 1
 CONSTRAINT rakyat_products_revision_positive CHECK (revision > 0);
UPDATE public.products AS p SET sort_order = initial.position
FROM (VALUES ('chatgpt',10),('capcut',20),('canva',30),('google',40),
 ('youtube',50),('spotify',60),('zoom',70)) AS initial(id,position)
WHERE p.id=initial.id;
ALTER TABLE public.products ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE public.products ADD CONSTRAINT rakyat_products_sort_nonnegative CHECK (sort_order >= 0);
CREATE INDEX rakyat_products_order_v1 ON public.products (sort_order,id);

CREATE FUNCTION public.rakyat_products_metadata_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.revision := 1;
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id THEN
   RAISE EXCEPTION 'Product ID is immutable';
  END IF;
  NEW.revision := OLD.revision + 1;
 END IF;
 NEW.updated_at := pg_catalog.clock_timestamp();
 RETURN NEW;
END
$function$;
-- Do not inherit broad function defaults. Trigger invocation needs no client EXECUTE.
REVOKE ALL PRIVILEGES ON FUNCTION public.rakyat_products_metadata_v1() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rakyat_products_metadata_v1 BEFORE INSERT OR UPDATE ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.rakyat_products_metadata_v1();

DO $assertions$
BEGIN
 IF EXISTS (SELECT 1 FROM public.products AS p FULL JOIN rakyat_products_before AS b USING(id)
  WHERE (to_jsonb(p)-'sort_order'-'revision') IS DISTINCT FROM b.row_data) THEN
  RAISE EXCEPTION 'Existing product fields changed';
 END IF;
 IF (SELECT state FROM rakyat_security_current) IS DISTINCT FROM (SELECT state FROM rakyat_security_before) THEN
  RAISE EXCEPTION 'RLS, policies, ACL, ownership or is_admin changed';
 END IF;
 IF (SELECT count(*) FROM public.products) <> 7 OR
  (SELECT sum(jsonb_array_length(plans)) FROM public.products) <> 14 OR EXISTS (
  SELECT 1 FROM public.products AS p LEFT JOIN
   (VALUES ('chatgpt',10),('capcut',20),('canva',30),('google',40),
    ('youtube',50),('spotify',60),('zoom',70)) AS expected(id,position) USING(id)
  WHERE expected.id IS NULL OR p.sort_order IS DISTINCT FROM expected.position OR p.revision IS DISTINCT FROM 1) THEN
  RAISE EXCEPTION 'Initial order, revision or counts mismatch';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles AS role_entry WHERE role_entry.rolname IN ('anon','authenticated')
  AND has_function_privilege(role_entry.oid,'public.rakyat_products_metadata_v1()','EXECUTE')) THEN
  RAISE EXCEPTION 'Unexpected effective function EXECUTE grant';
 END IF;
END
$assertions$;
-- Visible rehearsal result BEFORE rollback; assertions above abort on mismatch.
SELECT 'rehearsal_checks_passed' AS result, count(*) AS products,
 sum(jsonb_array_length(plans)) AS packages,
 array_agg(id ORDER BY sort_order,id) AS product_order,
 bool_and(revision=1) AS initial_revisions_passed FROM public.products;
-- Re-running after a committed migration aborts before modifying anything.
ROLLBACK;
