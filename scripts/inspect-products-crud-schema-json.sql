-- READ ONLY: exactly one SELECT result, one row, one JSONB column.
-- Run manually in SQL Editor as postgres. Copy as JSON preserves all sections.
-- No Auth calls or account contents; only metadata and aggregate catalog counts.
WITH targets AS (
 SELECT c.*,n.nspname FROM pg_class AS c
 JOIN pg_namespace AS n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('products','store_settings','admin_users')
 AND c.relkind IN ('r','p')
), columns_metadata AS (
 SELECT t.relname AS table_name,a.attnum AS ordinal_position,a.attname AS column_name,
 format_type(a.atttypid,a.atttypmod) AS formatted_type,
 tn.nspname AS type_schema,ty.typname AS type_name,a.attnotnull AS not_null,
 pg_get_expr(ad.adbin,ad.adrelid) AS default_expression,
 a.attidentity AS identity_kind,a.attgenerated AS generated_kind
 FROM targets AS t JOIN pg_attribute AS a ON a.attrelid=t.oid
 JOIN pg_type AS ty ON ty.oid=a.atttypid JOIN pg_namespace AS tn ON tn.oid=ty.typnamespace
 LEFT JOIN pg_attrdef AS ad ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum
 WHERE a.attnum>0 AND NOT a.attisdropped
), table_acl AS (
 SELECT t.relname AS table_name,pg_get_userbyid(acl.grantor) AS grantor,
 CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee,
 acl.privilege_type,acl.is_grantable FROM targets AS t
 CROSS JOIN LATERAL aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) AS acl
), column_acl AS (
 SELECT t.relname AS table_name,a.attname AS column_name,
 pg_get_userbyid(acl.grantor) AS grantor,
 CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee,
 acl.privilege_type,acl.is_grantable FROM targets AS t
 JOIN pg_attribute AS a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
 CROSS JOIN LATERAL aclexplode(a.attacl) AS acl
), functions_metadata AS (
 SELECT p.* FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('is_admin','rakyat_products_metadata_v1')
), relevant_objects AS (
 SELECT 'pg_class'::regclass::oid AS classid,t.oid AS objid FROM targets AS t
 UNION
 SELECT 'pg_proc'::regclass::oid,p.oid FROM functions_metadata AS p
), dependencies AS (
 SELECT DISTINCT d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype
 FROM pg_depend AS d JOIN relevant_objects AS o
 ON (d.refclassid=o.classid AND d.refobjid=o.objid)
 OR (d.classid=o.classid AND d.objid=o.objid)
), effective_table_grants AS (
 SELECT r.rolname,t.relname AS table_name,priv.name AS privilege_type,
 has_table_privilege(r.oid,t.oid,priv.name) AS allowed
 FROM pg_roles AS r CROSS JOIN targets AS t CROSS JOIN
 (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) AS priv(name)
 WHERE r.rolname IN ('anon','authenticated')
), effective_column_grants AS (
 SELECT r.rolname,t.relname AS table_name,a.attname AS column_name,
 priv.name AS privilege_type,has_column_privilege(r.oid,t.oid,a.attnum,priv.name) AS allowed
 FROM pg_roles AS r CROSS JOIN targets AS t
 JOIN pg_attribute AS a ON a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped
 CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) AS priv(name)
 WHERE r.rolname IN ('anon','authenticated')
)
SELECT jsonb_build_object(
 'format','rakyat-crud-schema-inspection-v1',
 'captured_at',statement_timestamp(),'database',current_database(),
 'postgres_version',current_setting('server_version'),'executor',current_user,
 'scope',jsonb_build_array('public.products','public.store_settings','public.admin_users'),
 'tables',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'table_name',t.relname,'oid',t.oid::text,'owner',pg_get_userbyid(t.relowner),
  'rls_enabled',t.relrowsecurity,'force_rls',t.relforcerowsecurity,'raw_acl',t.relacl::text
 ) ORDER BY t.relname),'[]'::jsonb) FROM targets AS t),
 'columns',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.table_name,c.ordinal_position),'[]'::jsonb) FROM columns_metadata AS c),
 'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'table_name',t.relname,'name',c.conname,'type',c.contype,
  'validated',c.convalidated,'definition',pg_get_constraintdef(c.oid)
 ) ORDER BY t.relname,c.conname),'[]'::jsonb)
 FROM pg_constraint AS c JOIN targets AS t ON t.oid=c.conrelid),
 'indexes',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'table_name',t.relname,'name',ic.relname,'valid',i.indisvalid,'ready',i.indisready,
  'unique',i.indisunique,'definition',pg_get_indexdef(i.indexrelid)
 ) ORDER BY t.relname,ic.relname),'[]'::jsonb)
 FROM pg_index AS i JOIN targets AS t ON t.oid=i.indrelid JOIN pg_class AS ic ON ic.oid=i.indexrelid),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'table_name',t.relname,'name',tr.tgname,'enabled',tr.tgenabled,
  'internal',tr.tgisinternal,'definition',pg_get_triggerdef(tr.oid),
  'function',tr.tgfoid::regprocedure::text
 ) ORDER BY t.relname,tr.tgname),'[]'::jsonb)
 FROM pg_trigger AS tr JOIN targets AS t ON t.oid=tr.tgrelid),
 'policies',(SELECT coalesce(jsonb_agg(to_jsonb(pol) ORDER BY pol.tablename,pol.policyname),'[]'::jsonb)
 FROM pg_policies AS pol WHERE pol.schemaname='public' AND pol.tablename IN ('products','store_settings','admin_users')),
 'table_acl',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.table_name,a.grantee,a.privilege_type),'[]'::jsonb) FROM table_acl AS a),
 'column_acl',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.table_name,a.column_name,a.grantee,a.privilege_type),'[]'::jsonb) FROM column_acl AS a),
 'effective_table_grants',(SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.rolname,g.table_name,g.privilege_type),'[]'::jsonb) FROM effective_table_grants AS g),
 'effective_column_grants',(SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.rolname,g.table_name,g.column_name,g.privilege_type),'[]'::jsonb) FROM effective_column_grants AS g),
 'roles',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'name',r.rolname,'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,'inherit',r.rolinherit
 ) ORDER BY r.rolname),'[]'::jsonb) FROM pg_roles AS r
 WHERE r.rolname IN ('anon','authenticated') OR r.oid IN (SELECT relowner FROM targets UNION SELECT proowner FROM functions_metadata)),
 'role_memberships',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'member',pg_get_userbyid(m.member),'role',pg_get_userbyid(m.roleid),
  'admin_option',m.admin_option,'inherit_option',m.inherit_option,'set_option',m.set_option
 ) ORDER BY m.member,m.roleid),'[]'::jsonb) FROM pg_auth_members AS m),
 'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
  'security_definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,
  'definition',pg_get_functiondef(p.oid),'raw_acl',p.proacl::text
 ) ORDER BY p.oid::regprocedure::text),'[]'::jsonb) FROM functions_metadata AS p),
 'function_acl',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'signature',p.oid::regprocedure::text,'grantor',pg_get_userbyid(acl.grantor),
  'grantee',CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,
  'privilege_type',acl.privilege_type,'is_grantable',acl.is_grantable
 ) ORDER BY p.oid,acl.grantee,acl.privilege_type),'[]'::jsonb)
 FROM functions_metadata AS p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) AS acl),
 'effective_function_grants',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'role',r.rolname,'signature',p.oid::regprocedure::text,
  'execute',has_function_privilege(r.oid,p.oid,'EXECUTE')
 ) ORDER BY r.rolname,p.oid),'[]'::jsonb)
 FROM pg_roles AS r CROSS JOIN functions_metadata AS p WHERE r.rolname IN ('anon','authenticated')),
 'dependencies',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'dependent',pg_describe_object(d.classid,d.objid,d.objsubid),
  'referenced',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),'type',d.deptype
 ) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid),'[]'::jsonb) FROM dependencies AS d),
 'default_privileges',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'creator',pg_get_userbyid(d.defaclrole),'scope',CASE WHEN d.defaclnamespace=0 THEN 'global' ELSE ns.nspname END,
  'object_type',d.defaclobjtype,'raw_acl',d.defaclacl::text
 ) ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype),'[]'::jsonb)
 FROM pg_default_acl AS d LEFT JOIN pg_namespace AS ns ON ns.oid=d.defaclnamespace
 WHERE (d.defaclnamespace=0 OR ns.nspname='public') AND
 (pg_get_userbyid(d.defaclrole) IN ('postgres','supabase_admin') OR d.defaclrole IN (SELECT relowner FROM targets))),
 'counts',(SELECT jsonb_build_object('products',count(*),
  'plans',coalesce(sum(CASE WHEN jsonb_typeof(plans)='array' THEN jsonb_array_length(plans) ELSE 0 END),0),
  'invalid_plan_arrays',count(*) FILTER (WHERE jsonb_typeof(plans) IS DISTINCT FROM 'array')) FROM public.products),
 'store_settings_count',(SELECT count(*) FROM public.store_settings),
 'limitations',jsonb_build_array('Counts reflect executor visibility; RLS can filter rows.',
  'Dependencies are catalog-recorded direct edges; SQL function text or dynamic SQL may reference other objects without catalog edges.',
  'Default privileges section lists explicit catalog entries; use the existing grants verifier for effective default privilege checks.')
) AS crud_schema_inspection;
