// Local mocks or --live anon SELECT only. Does not execute any write/Auth operation.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(path,imports={}) {const ctx={exports:{},require:key=>{if(!(key in imports))throw Error('Unexpected import');return imports[key];}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);return ctx.exports;}
const model=load('src/lib/products.ts');
const catalog=load('src/lib/supabase/catalog.ts',{'../products':model});
const reader=load('src/lib/supabase/products.ts');
const shared=load('src/lib/supabase/product-source.ts',{'./products':reader,'./catalog':catalog});
const refresh=load('src/lib/supabase/product-refresh.ts');
const backup=JSON.parse(fs.readFileSync('rakyat-premium-backup-2026-10-30T09-05-23-204Z.json','utf8'));
const plain=x=>JSON.parse(JSON.stringify(x));
const rows=backup.products.map(({imageUrl,...p})=>({...p,image_url:imageUrl})).reverse();
function client(result){return {schema:name=>{assert.equal(name,'public');return {from:table=>{assert.equal(table,'products');return {select:columns=>{assert.equal(columns,reader.PRODUCT_COLUMNS);return {order:async()=>result()};}};}};}};}
async function run(){
 let reads=0;
 const c=client(()=>{reads++;return {data:rows,error:null};});
 const publicView=await shared.readSharedProducts(c),adminView=await shared.readSharedProducts(c);
 assert.equal(reads,2);assert.equal(publicView.status,'ready');assert.equal(adminView.status,'ready');
 assert.deepEqual(plain(publicView.products),backup.products);assert.deepEqual(plain(adminView.products),backup.products);
 assert.equal(adminView.products.reduce((sum,p)=>sum+p.plans.length,0),14);
 assert.equal((await shared.readSharedProducts(client(()=>({data:[],error:null})))).status,'empty');
 const fail=await shared.readSharedProducts(client(()=>({data:null,error:{code:'42501'}})));
 assert.equal(fail.status,'error');assert.equal(fail.products.length,0);
 // Fresh reads have no stale module cache; a changed remote fixture is reflected.
 const updated=structuredClone(rows);updated[0].name='Remote updated fixture';
 const reread=await shared.readSharedProducts(client(()=>({data:updated,error:null})));
 assert.ok(reread.products.some(p=>p.name==='Remote updated fixture'));
 let first=0,second=0;const unsubscribeA=refresh.subscribeProductsRefresh(()=>first++);
 const unsubscribeB=refresh.subscribeProductsRefresh(()=>second++);
 refresh.refreshSupabaseProducts();assert.equal(first,1);assert.equal(second,1);
 unsubscribeA();refresh.refreshSupabaseProducts();assert.equal(first,1);assert.equal(second,2);unsubscribeB();
 // Exercise the default hook path used by both pages, not its custom-order compatibility path.
 let sharedCalls=0;
 function mount(){const states=[],cleanups=[];
  const hook=load('src/lib/supabase/use-catalog-preview.ts',{
   react:{useState:value=>[value,next=>states.push(next)],useEffect:effect=>{const cleanup=effect();if(cleanup)cleanups.push(cleanup);}},
   './client':{createClient:()=>c},'./products':reader,'./catalog':catalog,
   './product-source':{readSharedProducts:async client=>{sharedCalls++;return shared.readSharedProducts(client);}},
   './product-refresh':refresh,
  });
  const result=hook.useCatalogPreview(true);
  return {states,result,close:()=>cleanups.forEach(fn=>fn())};
 }
 const publicHook=mount(),adminHook=mount();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sharedCalls,2);
 assert.deepEqual(plain(publicHook.states.at(-1).products),plain(adminHook.states.at(-1).products));
 assert.equal(typeof publicHook.result.refresh,'function');
 publicHook.close();adminHook.close();
 console.log('PASS local: both consumers share 7-product/14-plan mapping/order; empty/error isolated; fresh reread; refresh notifications and unsubscribe; no writer/cache/storage API.');
 if(process.argv.includes('--live')){
  const {createServerClient}=require('@supabase/ssr');const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url&&key?.startsWith('sb_publishable_'));
  const c=createServerClient(url,key,{cookies:{getAll:()=>[]},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
  const result=await shared.readSharedProducts(c);
  assert.equal(result.status,'ready');assert.deepEqual(plain(result.products),backup.products);
  console.log('PASS live anon: shared adapter returns 7 products/14 plans in approved order, every product field matches backup.');
 }
}
run().catch(()=>{console.error('FAIL shared source test. Credentials and data are not printed.');process.exitCode=1;});
