// Local: node scripts/test-supabase-products.cjs
// Optional anon SELECT: node --env-file=.env.local scripts/test-supabase-products.cjs --live
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {isDeepStrictEqual} = require('node:util');
const ts = require('typescript');

const source = fs.readFileSync('src/lib/supabase/products.ts', 'utf8');
const context = {exports:{}};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020}}).outputText, context);
const {mapSupabaseProducts, fetchSupabaseProducts, PRODUCT_COLUMNS} = context.exports;
const backup = JSON.parse(fs.readFileSync('rakyat-premium-backup-2026-10-30T09-05-23-204Z.json', 'utf8'));
const rows = backup.products.map(({imageUrl, ...product}) => ({...product, image_url:imageUrl}));
// JSON round-trip removes VM realm prototype differences for strict assertions.
const plain = value => JSON.parse(JSON.stringify(value));
const sorted = list => [...list].sort((a,b)=>a.id.localeCompare(b.id));

async function run() {
 const before = JSON.stringify(rows);
 const mapped = mapSupabaseProducts(rows);
 assert.equal(mapped.length,7);
 assert.equal(mapped.reduce((sum,p)=>sum+p.plans.length,0),14);
 assert.deepEqual(plain(mapped),backup.products);
 assert.equal(JSON.stringify(rows),before);
 mapped[0].plans[0].price=999;
 assert.equal(JSON.stringify(rows),before,'Mapping must not mutate/share plans with source');
 assert.deepEqual(plain(mapSupabaseProducts([])),[]);
 for (const invalid of [null, {}, [null], [...rows,rows[0]], [{...rows[0],image_url:null}],
  [{...rows[0],plans:[]}], [{...rows[0],plans:[null]}],
  [{...rows[0],plans:[{duration:'1 bulan',price:'45000'}]}],
  [{...rows[0],plans:[{duration:'',price:1}]}],
  [{...rows[0],plans:[{duration:'1 bulan',price:-1}]}],
  [{...rows[0],plans:[{duration:'1 bulan',price:1.5}]}]]) {
  assert.throws(()=>mapSupabaseProducts(invalid));
 }
 const calls=[];
 const mock = {schema(name){calls.push(['schema',name]);return this;},from(name){calls.push(['from',name]);return this;},
  select(columns){calls.push(['select',columns]);return this;},async order(column,options){calls.push(['order',column,options.ascending]);return {data:rows,error:null};}};
 assert.deepEqual(plain(await fetchSupabaseProducts(mock)),backup.products);
 assert.deepEqual(calls,[['schema','public'],['from','products'],['select',PRODUCT_COLUMNS],['order','id',true]]);
 await assert.rejects(()=>fetchSupabaseProducts({...mock,async order(){return {data:null,error:{code:'42501'}};}}),/42501/);
 await assert.rejects(()=>fetchSupabaseProducts({...mock,async order(){throw new Error('network');}}),/network/);
 console.log('PASS lokal: 7 produk/14 paket identik dengan backup, semua field dan urutan paket, URL kosong, validasi data rusak, non-mutasi, serta SELECT/error reader.');

 if (process.argv.includes('--live')) {
  const {createServerClient} = require('@supabase/ssr');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key?.startsWith('sb_publishable_'), 'Environment URL/publishable key belum valid.');
  // No cookies/login: an anonymous reader. Timeout without exposing fetch details.
  const client = createServerClient(url,key,{cookies:{getAll:()=>[]},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
  const actual = await fetchSupabaseProducts(client);
  assert.equal(actual.length,7);
  assert.equal(actual.reduce((sum,p)=>sum+p.plans.length,0),14);
  // Avoid logging actual data, credentials, or assertion diffs on failure.
  assert.ok(isDeepStrictEqual(sorted(plain(actual)),sorted(backup.products)), 'Data live berbeda dari backup.');
  console.log('PASS live anon: 7 produk dan 14 paket dari Supabase identik dengan backup; tanpa write/Auth call.');
 }
}
run().catch(()=>{console.error('FAIL: pengujian mapping/SELECT tidak lulus. Nilai kredensial dan data tidak ditampilkan.');process.exitCode=1;});
