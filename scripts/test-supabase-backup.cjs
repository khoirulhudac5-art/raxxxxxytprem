const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,imports={}){const ctx={exports:{},Date,URL,require:name=>name in imports?imports[name]:require(name)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);return ctx.exports;}
const model=load('src/lib/products.ts');
const mapper=load('src/lib/supabase/products.ts');
const catalog=load('src/lib/supabase/catalog.ts',{'../products':model});
const whatsapp=load('src/lib/whatsapp.ts',{'./config':{storeConfig:{whatsappNumber:''}},'./products':model});
const {exportSupabaseBackup}=load('src/lib/supabase/backup.ts',{'./products':mapper,'./catalog':catalog,'../whatsapp':whatsapp});
const original=JSON.parse(fs.readFileSync('rakyat-premium-backup-2026-10-30T09-05-23-204Z.json','utf8'));
const date='2026-10-30T09:05:23.204Z';
const rows=original.products.map(({imageUrl,...p})=>({...p,image_url:imageUrl,created_at:date,updated_at:date,secret_extra:'must-not-export'})).reverse();
const setting={id:'main',whatsapp_number:original.whatsapp.number,whatsapp_template:original.whatsapp.template,updated_at:date,secret_extra:'must-not-export'};
function client(products=rows,settings=[setting],fail=false){return {schema:name=>{assert.equal(name,'public');return {from:table=>({select:()=>({order:()=>table==='products'?{range:async(start,end)=>({data:products.slice(start,end+1),count:products.length,error:fail?{code:'42501'}:null})}:Promise.resolve({data:settings,count:settings.length,error:null})})})};}};}
async function run(){
 const output=await exportSupabaseBackup(client(),new Date(date));const backup=JSON.parse(output.json);
 assert.equal(backup.source,'supabase');assert.equal(backup.version,2);assert.equal(backup.counts.products,7);assert.equal(backup.counts.plans,14);
 assert.deepEqual(backup.products.map(({createdAt,updatedAt,...p})=>p),original.products);
 assert.deepEqual(backup.productOrder,original.products.map(p=>p.id));assert.deepEqual(backup.whatsapp,original.whatsapp);
 assert.ok(backup.products.every(p=>p.createdAt===date&&p.updatedAt===date));assert.equal(backup.storeSettings.updatedAt,date);
 const stockRows=structuredClone(rows);stockRows[0].plans[0].available=false;
 const stockBackup=JSON.parse((await exportSupabaseBackup(client(stockRows),new Date(date))).json);
 assert.equal(stockBackup.products.find(p=>p.id===stockRows[0].id).plans[0].available,false);
 assert.ok(!output.json.includes('must-not-export'));assert.ok(backup.warnings.length);
 await assert.rejects(()=>exportSupabaseBackup(client([])));await assert.rejects(()=>exportSupabaseBackup(client(rows,[])));
 await assert.rejects(()=>exportSupabaseBackup(client(rows,[setting,setting])));await assert.rejects(()=>exportSupabaseBackup(client(rows,[setting],true)));
 await assert.rejects(()=>exportSupabaseBackup(client([{...rows[0],plans:[]}])));
 await assert.rejects(()=>exportSupabaseBackup(client(rows,[{...setting,whatsapp_number:'invalid'}])));
 let reads=0;const unstable=client();unstable.schema=()=>({from:table=>({select:()=>({order:()=>table==='products'?{range:async()=>({data:rows.map((p,i)=>i===0?{...p,name:String(reads++)}:p),count:7,error:null})}:Promise.resolve({data:[setting],count:1,error:null})})})});
 await assert.rejects(()=>exportSupabaseBackup(unstable),/berubah/);
 const many=Array.from({length:201},(_,i)=>({...rows[0],id:'extra-'+i}));assert.equal(JSON.parse((await exportSupabaseBackup(client(many))).json).counts.products,201);
 for(const access of ['unauthenticated','denied','unavailable','admin']){
  let exports=0;
  const route=load('src/app/admin/backup/supabase/route.ts',{
   '@/lib/supabase/server':{createClient:async()=>({})},'@/lib/supabase/admin-access':{checkAdminAccess:async()=>access},
   '@/lib/supabase/backup':{exportSupabaseBackup:async()=>{exports++;return output;}},
  });
  const response=await route.GET();assert.equal(response.status,{unauthenticated:401,denied:403,unavailable:503,admin:200}[access]);
  assert.equal(exports,access==='admin'?1:0);assert.ok(response.headers.get('cache-control').includes('no-store'));
  if(access==='admin')assert.ok(response.headers.get('content-disposition').includes('attachment'));
 }
 console.log('PASS backup: 7 products/14 plans, order/images/timestamps/WhatsApp, paginated 201 rows, invalid/empty/changing data rejected, allowlist fields, server Admin-only download. No live Auth/write calls.');
 if(process.argv.includes('--live')){
  const {createServerClient}=require('@supabase/ssr');const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;assert.ok(url&&key?.startsWith('sb_publishable_'));
  const c=createServerClient(url,key,{cookies:{getAll:()=>[]},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
  // Data-layer SELECT validation only. This does not bypass or call the Admin-only download route.
  const result=JSON.parse((await exportSupabaseBackup(c)).json);
  assert.equal(result.counts.products,7);assert.equal(result.counts.plans,14);
  assert.deepEqual(result.products.map(({createdAt,updatedAt,...p})=>p),original.products);assert.deepEqual(result.whatsapp,original.whatsapp);
  console.log('PASS live SELECT data layer: latest Supabase products/settings match backup; no output file or credentials saved. Authenticated download still requires manual Admin test.');
 }
}
run().catch(()=>{console.error('FAIL backup test. Sensitive details omitted.');process.exitCode=1;});
