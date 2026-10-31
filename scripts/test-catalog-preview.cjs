// Local: node scripts/test-catalog-preview.cjs
// Live anon SELECT: node --env-file=.env.local scripts/test-catalog-preview.cjs --live
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
function load(file,imports={}) {
 const ctx={exports:{},require:name=>{if(!(name in imports))throw Error('Unexpected import');return imports[name];}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);
 return ctx.exports;
}
const productModel=load('src/lib/products.ts');
const catalog=load('src/lib/supabase/catalog.ts',{'../products':productModel});
const reader=load('src/lib/supabase/products.ts');
const shared=load('src/lib/supabase/product-source.ts',{'./products':reader,'./catalog':catalog});
const refresh=load('src/lib/supabase/product-refresh.ts');
const backup=JSON.parse(fs.readFileSync('rakyat-premium-backup-2026-10-30T09-05-23-204Z.json','utf8'));
const local=backup.products;
const plain=value=>JSON.parse(JSON.stringify(value));
const ids=list=>list.map(p=>p.id);
async function run() {
 const remote=[...local].sort((a,b)=>a.id.localeCompare(b.id));
 const before=JSON.stringify({local,remote});
 assert.deepEqual(plain(catalog.migratedCatalogOrder),ids(local));
 assert.equal(catalog.compareCatalogs(local,remote).sameData,true);
 assert.equal(catalog.compareCatalogs(local,remote).sameOrder,false);
 const ordered=catalog.orderCatalog(remote,ids(local));
 assert.deepEqual(plain(ordered),local);
 assert.equal(ordered.reduce((sum,p)=>sum+p.plans.length,0),14);
 // Browser order can change: reference is supplied, not assumed from backup forever.
 const custom=[...local].reverse();
 assert.deepEqual(plain(catalog.orderCatalog(remote,ids(custom))),custom);
 const unknown=[{...local[0],id:'new-z'},{...local[0],id:'new-a'}];
 assert.deepEqual(plain(ids(catalog.orderCatalog([...unknown,...remote],ids(local)))).slice(-2),['new-z','new-a']);
 assert.deepEqual(plain(ids(catalog.orderCatalog(remote.slice(1),ids(local)))),ids(local).filter(id=>id!==remote[0].id));
 assert.throws(()=>catalog.orderCatalog(remote,['chatgpt','chatgpt']));
 const changed=structuredClone(remote);changed[0].plans[0].price++;
 assert.equal(catalog.compareCatalogs(local,changed).sameData,false);
 assert.equal(JSON.stringify({local,remote}),before);
 const reads=[];
 const stored=catalog.readStoredCatalog({getItem:key=>{reads.push(key);return JSON.stringify(custom);}},productModel.STORAGE_KEY);
 assert.deepEqual(plain(stored),custom);assert.deepEqual(reads,[productModel.STORAGE_KEY]);
 for(const raw of [null,'invalid','{}'])assert.throws(()=>catalog.readStoredCatalog({getItem:()=>raw},productModel.STORAGE_KEY));
 assert.deepEqual(plain(catalog.readStoredCatalog({getItem:()=> '[]'},productModel.STORAGE_KEY)),[]);
 assert.equal((await catalog.loadCatalogPreview(async()=>remote,ids(local))).status,'ready');
 const empty=await catalog.loadCatalogPreview(async()=>[],ids(local));
 assert.equal(empty.status,'empty');assert.equal(empty.scope,'visible_rows');assert.equal(empty.error,null);
 const failed=await catalog.loadCatalogPreview(async()=>{throw Error('network / secret');},ids(local));
 assert.equal(failed.status,'error');assert.equal(failed.products.length,0);assert.ok(!failed.error.includes('secret'));
 assert.equal((await catalog.loadCatalogPreview(async()=>remote,['x','x'])).status,'error');

 // Mock React lifecycle: inactive hooks must not query; late completions are ignored.
 function mount(enabled,promise) {
  const states=[];let calls=0,cleanup;
  const hook=load('src/lib/supabase/use-catalog-preview.ts',{
   react:{useState:initial=>[initial,value=>states.push(value)],useEffect:effect=>{cleanup=effect();}},
   './client':{createClient:()=>{calls++;return {};}},
   './products':{fetchSupabaseProducts:()=>promise},'./catalog':catalog,'./product-source':shared,'./product-refresh':refresh,
  });
  const initial=hook.useCatalogPreview(enabled,ids(local));
  return {states,initial,calls,close:()=>cleanup?.()};
 }
 const disabled=mount(false,Promise.resolve(remote));assert.equal(disabled.calls,0);assert.equal(disabled.initial.state.status,'idle');
 const active=mount(true,Promise.resolve(remote));assert.equal(active.states[0].status,'loading');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(active.states.at(-1).status,'ready');
 let resolve;const pending=new Promise(done=>{resolve=done;});const stale=mount(true,pending);stale.close();resolve(remote);
 await new Promise(done=>setImmediate(done));assert.equal(stale.states.length,1);
 console.log('PASS lokal: urutan backup/browser, 7 produk/14 paket, beda data, ID baru/hilang, non-mutasi, empty/error terpisah, idle/loading/ready dan respons terlambat.');
 console.log('Urutan referensi backup:',ids(local).join(', '));
 console.log('Urutan reader berdasarkan ID:',ids(remote).join(', '));
 if(process.argv.includes('--live')) {
  const {createServerClient}=require('@supabase/ssr');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url&&key?.startsWith('sb_publishable_'));
  const client=createServerClient(url,key,{cookies:{getAll:()=>[]},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
  const actual=await reader.fetchSupabaseProducts(client);
  const comparison=catalog.compareCatalogs(local,actual);
  assert.equal(comparison.sameData,true);assert.equal(actual.length,7);
  const aligned=catalog.orderCatalog(actual,ids(local));
  assert.deepEqual(plain(aligned),local);
  console.log('PASS live: data Supabase cocok backup; urutan setelah penyesuaian identik. Urutan mentah:',ids(actual).join(', '));
 }
}
run().catch(()=>{console.error('FAIL pengujian preview katalog. Kredensial/data tidak ditampilkan.');process.exitCode=1;});
