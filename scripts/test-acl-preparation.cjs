// Static/string tests only. No PostgreSQL connection and no generated file writes.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {generate,unwrap}=require('./generate-acl-rollback.cjs');
const fixture={format:'rakyat-acl-snapshot-v1',database:'postgres',captured_at:'2026-10-30T00:00:00Z',executor:'postgres',
 tables:['admin_users','products','store_settings'].map((name,index)=>({name,oid:String(100+index),owner:'postgres',rls:true,force_rls:false})),
 policies:[],is_admin_definition:'synthetic fixture only',
 table_acl:[{table_name:'products',grantor:'postgres',grantee:'anon',privilege_type:'SELECT',is_grantable:false},
 {table_name:'products',grantor:'postgres',grantee:'authenticated',privilege_type:'UPDATE',is_grantable:true}],
 column_acl:[{table_name:'products',column_name:'name',grantor:'postgres',grantee:'authenticated',privilege_type:'SELECT',is_grantable:false}],
 default_groups:['postgres','supabase_admin'].flatMap(creator=>['r','S','f'].flatMap(kind=>['global','public'].map(scope=>({creator,kind,scope})))),
 default_acl:[{creator:'postgres',kind:'S',scope:'public',grantor:'postgres',grantee:'anon',privilege_type:'USAGE',is_grantable:false},
 {creator:'postgres',kind:'f',scope:'global',grantor:'postgres',grantee:'PUBLIC',privilege_type:'EXECUTE',is_grantable:false}]};
const before=JSON.stringify(fixture);
assert.deepEqual(unwrap([{acl_snapshot:JSON.stringify(fixture)}]),fixture);
for(const scope of ['tables','defaults-postgres','defaults-supabase-admin']) {
 const sql=generate(fixture,scope);
 assert.ok(sql.includes('BEGIN;') && sql.trim().endsWith('ROLLBACK;'));
 assert.ok(!/GRANT\s+ALL\b/i.test(sql));
 assert.ok(sql.includes('RAISE EXCEPTION'));
 if(scope==='tables') {
  assert.ok(sql.includes('GRANT SELECT ON TABLE public."products" TO "anon";'));
  assert.ok(sql.includes('GRANT UPDATE ON TABLE public."products" TO "authenticated" WITH GRANT OPTION;'));
  assert.ok(sql.includes('GRANT SELECT ("name") ON TABLE public."products" TO "authenticated";'));
 } else assert.ok(sql.includes("CASE WHEN k.kind='S' THEN 's'::\"char\" ELSE k.kind END"));
}
assert.equal(JSON.stringify(fixture),before);
const bad=structuredClone(fixture);bad.table_acl[0].grantor='another_owner';assert.throws(()=>generate(bad,'tables'));
const malformed=structuredClone(fixture);malformed.tables[0].owner='different_owner';assert.throws(()=>generate(malformed,'tables'));
assert.throws(()=>generate(fixture,'all'));
for(const file of ['verify-supabase-grants.sql','repair-default-privileges-postgres.sql','repair-default-privileges-supabase-admin.sql']) {
 const sql=fs.readFileSync('scripts/'+file,'utf8');
 assert.ok(!sql.includes('acldefault(k.kind,'));
 assert.ok(sql.includes("CASE WHEN k.kind='S' THEN 's'::\"char\" ELSE k.kind END"));
}
const verify=fs.readFileSync('scripts/verify-supabase-grants.sql','utf8');
for(const group of ['table_grants_passed','is_admin_passed','default_privileges_passed'])assert.ok(verify.includes("'"+group+"'"));
const snapshot=fs.readFileSync('scripts/snapshot-supabase-acl.sql','utf8');
const code=snapshot.replace(/--[^\n]*/g,'').replace(/'(?:''|[^'])*'/g,"''");
assert.equal((code.match(/;/g)||[]).length,1);assert.ok(/^\s*WITH\b/.test(code));
assert.ok(!/\b(?:INSERT|UPDATE|DELETE|REVOKE|GRANT|ALTER|CALL|DO)\b/i.test(code));
console.log('PASS: sequence mapping, isolated summaries, read-only snapshot, rollback generator/explicit grants/grant options/column ACL, rejected unsupported input, no mutation. No SQL executed.');
