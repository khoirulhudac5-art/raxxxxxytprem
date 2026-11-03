// Offline only. No database, credentials, network, migrations or production changes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {NextRequest}=require('next/server');
function load(file,imports={},extra={}){
 const context={exports:{},URL,Date,AbortSignal,AbortController,TextDecoder,Uint8Array,setTimeout,clearTimeout,
  require:n=>n==='server-only'?{}:Object.hasOwn(imports,n)?imports[n]:require(n),...extra};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 return context.exports;
}
const contract=load('src/lib/analytics/contract.ts');
const id='12345678-1234-4234-9234-123456789abc';
const event={id,type:'page_view',catalog:'apps',page:'apps_catalog'};
const json=v=>JSON.parse(JSON.stringify(v));
async function run(){
 assert(contract.validateEvent(event));
 for(const patch of [{ip:'forbidden'},{id:'x'},{visitor:'x'},{issuedAt:Date.now()+60000},{issuedAt:Date.now()-30*86400000},{issuedAt:1.1},{type:'purchase'},{catalog:'ebooks'},{productId:'unexpected'},{page:'admin'}])assert.equal(contract.validateEvent({...event,...patch}),null,JSON.stringify(patch));
 assert(contract.validateEvent({...event,type:'catalog_click',catalog:'ebooks'}));
 assert(contract.validateEvent({...event,type:'product_click',productId:'canva'}));
 assert.equal(contract.validateEvent({...event,type:'purchase_whatsapp_click',productId:'canva'}),null);
 assert(contract.validateEvent({...event,type:'purchase_whatsapp_click',productId:'canva',page:'app_detail'}));
 for(const path of ['/admin','/admin/analytics','/api/analytics','/privasi','/ebook/preview-assets/banner.svg'])assert.equal(contract.publicPage(path),null);
 assert.equal(contract.publicPage('/ebook/book'),'ebook_detail');

 const env={NODE_ENV:'production',ANALYTICS_ENABLED:'true',ANALYTICS_PUBLIC_ORIGIN:'https://store.example.com',ANALYTICS_INGEST_SECRET:'fake-server-secret',NEXT_PUBLIC_SUPABASE_URL:'https://db.example.com',ANALYTICS_APPROVED_SUPABASE_URL:'https://db.example.com'};
 const config=e=>load('src/lib/analytics/server.ts',{}, {process:{env:e}}).analyticsOrigin();
 assert.equal(config(env),env.ANALYTICS_PUBLIC_ORIGIN);
 assert.equal(config({...env,NEXT_PUBLIC_SUPABASE_URL:'https://kzsoobgkqftzheqjtwxs.supabase.co',ANALYTICS_APPROVED_SUPABASE_URL:'https://kzsoobgkqftzheqjtwxs.supabase.co'}),null);
 for(const patch of [{NODE_ENV:'development'},{ANALYTICS_ENABLED:'false'},{VERCEL_ENV:'preview'},{ANALYTICS_APPROVED_SUPABASE_URL:'different'},{ANALYTICS_PUBLIC_ORIGIN:'http://localhost:3000'},{ANALYTICS_PUBLIC_ORIGIN:'https://127.0.0.1'},{ANALYTICS_PUBLIC_ORIGIN:'https://store.example.com/path'}])assert.equal(config({...env,...patch}),null);

 let enabled=true,access='admin',calls=0,rpcResult={data:true,error:null},args;
 const route=load('src/app/api/analytics/route.ts',{
  '@/lib/analytics/server':{analyticsOrigin:()=>enabled?env.ANALYTICS_PUBLIC_ORIGIN:null,analyticsWriter:()=>({rpc:async(name,input)=>{assert.equal(name,'analytics_ingest_v1');calls++;args=input;return rpcResult;}})},
  '@/lib/analytics/contract':contract,'@/lib/supabase/server':{createClient:async()=>({})},'@/lib/supabase/admin-access':{checkAdminAccess:async()=>access},
 },{process:{env}});
 function req(body=event,headers={},url='https://store.example.com/api/analytics'){
  return new NextRequest(url,{method:'POST',headers:{origin:env.ANALYTICS_PUBLIC_ORIGIN,'sec-fetch-site':'same-origin','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
 }
 enabled=false;assert.equal((await route.POST(req())).status,204);assert.equal(calls,0);enabled=true;
 assert.equal((await route.POST(req(event,{origin:'https://attacker.example'}))).status,403);
 assert.equal((await route.POST(req(event,{'sec-fetch-site':'cross-site'}))).status,403);
 assert.equal((await route.POST(req(event,{},'https://preview.example.com/api/analytics'))).status,403);
 assert.equal((await route.POST(req(event,{'content-type':'text/plain'}))).status,415);
 assert.equal((await route.POST(req('x'.repeat(2049)))).status,413);
 assert.equal((await route.POST(req('{broken'))).status,400);
 assert.equal((await route.POST(req({...event,ip:'forbidden'}))).status,400);
 for(const headers of [{'dnt':'1'},{'sec-gpc':'1'},{'user-agent':'Googlebot'}])assert.equal((await route.POST(req(event,headers))).status,204);
 assert.equal(calls,0);
 for(const headers of [{'next-router-prefetch':'1'},{purpose:'prefetch'},{'sec-purpose':'prefetch'}])assert.equal((await route.POST(req(event,headers))).status,204);
 assert.equal(calls,0);
 for(const status of ['admin','unavailable']){access=status;assert.equal((await route.POST(req(event,{cookie:'sb-test-auth-token=mock'}))).status,204);}
 assert.equal(calls,0);access='denied';
 assert.equal((await route.POST(req(event,{cookie:'sb-test-auth-token=mock'}))).status,204);
 assert.equal(calls,1);assert.match(args.p_visitor,/^[a-f0-9]{64}$/);assert.notEqual(args.p_visitor,id);
 assert.deepEqual(Object.keys(args).sort(),['p_catalog','p_id','p_page','p_product','p_type','p_visitor']);
 const previousKey=args.p_visitor;await route.POST(req());assert.notEqual(args.p_visitor,previousKey);
 rpcResult={data:false,error:null};assert.equal((await route.POST(req())).status,429);
 rpcResult={data:null,error:{code:'mock'}};assert.equal((await route.POST(req())).status,503);

 // Mount the actual tracker effects with a small hook/environment harness.
 const storage=new Map(),listeners={},domListeners={},sent=[];
 let path='/',hook=0,state=[],refs=[],effects=[],previous=[],frames=[],clock=Date.now();
 const fakeReact={useState(initial){const i=hook++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=v;}];},useRef(initial){const i=hook++;return refs[i]??=( {current:initial});},useEffect(fn,deps){const i=hook++;if(!previous[i]||deps.some((d,j)=>d!==previous[i].deps[j]))effects.push({i,fn,deps});}};
 const win={addEventListener:(k,f)=>listeners[k]=f,removeEventListener:k=>delete listeners[k],dispatchEvent:e=>listeners[e.type]?.()};
 class El{constructor(dataset){this.dataset=dataset;}closest(){return this;}}
 const tracker=load('src/components/analytics-tracker.tsx',{
  react:fakeReact,'next/navigation':{usePathname:()=>path},'next/link':{default:()=>null},'@/lib/analytics/contract':contract,
 },{localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  navigator:{doNotTrack:'0'},window:win,location:{origin:env.ANALYTICS_PUBLIC_ORIGIN,search:''},URLSearchParams,Event,Element:El,
  document:{visibilityState:'visible',addEventListener:(k,f,capture)=>{if(k==='click'||k==='auxclick')assert.equal(capture,true,'Track before Next Link prevents default');domListeners[k]=f;},removeEventListener:k=>delete domListeners[k]},
  crypto:{randomUUID:()=>id},requestAnimationFrame:f=>(frames.push(f),frames.length),cancelAnimationFrame:()=>{},
  fetch:async(url,options)=>{sent.push(JSON.parse(options.body));return {};},
  Date:class extends Date{static now(){return clock;}},
 });
 function render(){hook=0;tracker.AnalyticsTracker({origin:env.ANALYTICS_PUBLIC_ORIGIN});const list=effects;effects=[];for(const e of list){previous[e.i]?.cleanup?.();previous[e.i]={deps:e.deps,cleanup:e.fn()};}const f=frames;frames=[];f.forEach(x=>x());}
 storage.set('rp-analytics-browser-v1','legacy-id');
 render();render();assert.equal(sent.length,1);assert.equal(sent[0].type,'page_view');
 assert(!storage.has('rp-analytics-browser-v1'));
 assert.deepEqual(Object.keys(sent[0]).sort(),['catalog','id','page','type']);
 render();render();assert.equal(sent.length,1); // Data renders are not visits.
 const click={isTrusted:true,defaultPrevented:false,type:'click',button:0,target:new El({analyticsEvent:'product_click',analyticsCatalog:'apps',analyticsProduct:'canva'})};
 domListeners.click(click);domListeners.click(click);assert.equal(sent.length,2); // Debounce.
 clock+=2000;path='/produk/canva';render();assert.equal(sent.length,3);
 path='/admin/analytics';render();assert.equal(sent.length,3);assert(!domListeners.click);
 clock+=2000;path='/';render();assert.equal(sent.length,4);
 domListeners.click({...click,target:new El({analyticsEvent:'catalog_click',analyticsCatalog:'ebooks'})});assert.equal(sent.at(-1).type,'catalog_click');
 clock+=2000;path='/produk/canva';render();
 domListeners.click({...click,target:new El({analyticsEvent:'purchase_whatsapp_click',analyticsCatalog:'apps',analyticsProduct:'canva'})});assert.equal(sent.at(-1).type,'purchase_whatsapp_click');
 for(const e of previous)e?.cleanup?.();

 const report={days:1,timezone:'Asia/Jakarta',from:'2026-11-02',through:'2026-11-02',retentionDays:90,totals:{visits:3,visitors:2,views:8,products:4,whatsapp:1,apps:1,ebooks:2},daily:[{day:'2026-11-02',visits:3,visitors:2,views:8}],top:[{catalog:'apps',product_id:'canva',name:'Canva <script>',clicks:4}]};
 const model=load('src/lib/analytics/report.ts');assert(model.validReport(report));assert(!model.validReport({...report,totals:{...report.totals,visits:-1}}));assert(!model.validReport({...report,daily:[]}));
 const Link=({href,children,...props})=>React.createElement('a',{href,...props},children);
 const dashboard=load('src/components/analytics-dashboard.tsx',{'next/link':{default:Link}});
 const html=(state,report)=>renderToStaticMarkup(React.createElement(dashboard.AnalyticsDashboard,{days:1,state,report}));
 assert(html('ready',report).includes('Canva &lt;script&gt;'));assert(html('disabled').includes('Analytics belum diaktifkan'));assert(html('error').includes('role="alert"'));
 const empty=json(report);for(const k in empty.totals)empty.totals[k]=0;empty.daily[0]={...empty.daily[0],visits:0,visitors:0,views:0};empty.top=[];
 assert(html('ready',empty).includes('Belum ada aktivitas tercatat'));
 console.log('PASS analytics: anonymous contract, production gates, Origin/metadata/body limits, privacy/bots/Admin exclusion, HMAC, RPC failures, automatic tracker/routes/debounce, dashboard states and escaping. Offline mocks; SQL not executed.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
