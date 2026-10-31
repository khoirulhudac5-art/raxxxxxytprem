// Static checks only. Does not connect to a database or execute SQL.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname,name),'utf8');
const migration = read('prepare-products-crud-schema.sql');
const rollback = read('rollback-products-crud-schema.sql');
for (const sql of [migration,rollback]) {
 assert.match(sql,/BEGIN;/);
 assert.match(sql,/ROLLBACK;\s*$/);
 assert.doesNotMatch(sql,/^\s*COMMIT\s*;/m);
 assert.doesNotMatch(sql,/\bGRANT\s+ALL\b/i);
 assert.doesNotMatch(sql,/^\s*(?:DELETE|TRUNCATE)\s/im);
 assert.doesNotMatch(sql,/^\s*(?:ALTER|UPDATE|INSERT\s+INTO|DROP\s+TABLE)\s+(?:TABLE\s+)?public\.(?:admin_users|store_settings)\b/im);
 const tags = sql.match(/\$(?:[a-z_][a-z_0-9]*)?\$/gi)||[];
 for(const tag of new Set(tags)) assert.equal(tags.filter(x=>x===tag).length,2,tag);
}
assert.match(migration,/SECURITY INVOKER SET search_path = ''/);
assert.match(migration,/NEW\.revision := OLD\.revision \+ 1/);
assert.match(migration,/REVOKE ALL PRIVILEGES ON FUNCTION[^;]+FROM PUBLIC, anon, authenticated/);
assert.ok(migration.indexOf('UPDATE public.products') < migration.indexOf('CREATE TRIGGER'));
assert.match(migration,/to_jsonb\(p\)-'sort_order'-'revision'/);
assert.match(migration,/state FROM rakyat_security_current\) IS DISTINCT FROM/);
assert.match(migration,/p\.sort_order IS DISTINCT FROM expected\.position/);
assert.match(migration,/p\.revision IS DISTINCT FROM 1/);
assert.match(migration,/sum\(jsonb_array_length\(plans\)\)[\s\S]*<> 14/);
assert.match(migration,/rehearsal_checks_passed/);
const verifier=read('verify-products-crud-schema.sql');
for(const check of ['initial_order_passed','initial_revision_passed','counts_passed','rls_passed','table_grants_passed','policies_passed','trigger_passed','trigger_function_passed','trigger_execute_restricted'])assert.ok(verifier.includes("'"+check+"'"));
assert.match(verifier,/count\(\*\)=48 AND bool_and\(passed\)/);
assert.match(verifier,/count\(DISTINCT \(tablename,cmd\)\)=8/);
assert.match(rollback,/p\.revision <> 1/);
for(const [i,id] of ['chatgpt','capcut','canva','google','youtube','spotify','zoom'].entries()) {
 assert.ok(migration.includes(`('${id}',${(i+1)*10})`));
 assert.ok(rollback.includes(`('${id}',${(i+1)*10})`));
}
for(const name of ['inspect-products-crud-schema.sql','verify-products-crud-schema.sql']) {
 const sql=read(name).replace(/--[^\n]*/g,'');
 assert.match(sql,/BEGIN READ ONLY;/);
 const codeOnly=sql.replace(/'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(codeOnly,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE|TRUNCATE|CALL|DO)\b/i);
}
console.log('PASS: static transaction guards, order, metadata trigger, scoped rollback and read-only inspection.');
console.log('Not a PostgreSQL parser or execution/concurrency test.');
