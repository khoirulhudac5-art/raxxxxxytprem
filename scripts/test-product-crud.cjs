// All requests and writes are in-memory mocks. No live Supabase calls.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,imports={}){const ctx={exports:{},URL,TextDecoder,process:{env:{}},require:n=>n==='server-only'?{}:n in imports?imports[n]:require(n)};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);return {module:ctx.exports,ctx};}
const model=load('src/lib/products.ts').module;
const reader=load('src/lib/supabase/products.ts').module;
const crud=load('src/lib/supabase/product-crud.ts',{'./products':reader,'../products':model}).module;
const backup=JSON.parse(fs.readFileSync('rakyat-premium-backup-2026-10-30T09-05-23-204Z.json','utf8'));
let rows=backup.products.map((p,i)=>({...p,image_url:p.imageUrl||'',revision:1,sort_order:(i+1)*10})),writes=0;
function client(schemaError=false){return {schema:()=>({from:()=>{
 let op='read',payload,filters={};const q={select(){if(op==='read')return q;return Promise.resolve(apply());},order(){return q;},eq(k,v){filters[k]=v;return q;},update(p){op='update';payload=p;return q;},delete(){op='delete';return q;},insert(p){op='create';payload=p;return {select:()=>({single:async()=>{writes++;if(rows.some(r=>r.id===p.id))return {error:{code:'23505'}};const row={...p,revision:1};rows.push(row);return {data:row};}})};},then(resolve,reject){return Promise.resolve(schemaError?{error:{code:'42703'}}:{data:structuredClone(rows)}).then(resolve,reject);}};
 function apply(){writes++;const row=rows.find(r=>r.id===filters.id&&r.revision===filters.revision);if(!row)return {data:[]};if(op==='update'){Object.assign(row,payload);row.revision++;}else rows=rows.filter(r=>r!==row);return {data:[structuredClone(row)]};}return q;
 }})};}
async function run(){
 const flag=load('src/lib/supabase/crud-flag.ts');assert.equal(flag.module.productCrudEnabled(),false);
 Object.assign(flag.ctx.process.env,{NODE_ENV:'production',SUPABASE_PRODUCT_CRUD_ENABLED:'true',SUPABASE_PRODUCT_CRUD_APPROVED_URL:'x',NEXT_PUBLIC_SUPABASE_URL:'x'});assert.equal(flag.module.productCrudEnabled(),true);
 flag.ctx.process.env.NODE_ENV='development';assert.equal(flag.module.productCrudEnabled(),true);
 flag.ctx.process.env.SUPABASE_PRODUCT_CRUD_APPROVED_URL='other';assert.equal(flag.module.productCrudEnabled(),false);
 const list=await crud.executeProductCrud(client(),{operation:'list'});assert.equal(list.products.length,7);assert.equal(list.products.reduce((n,p)=>n+p.plans.length,0),14);
 const edit={operation:'update',id:'chatgpt',revision:1,product:{...backup.products[0],plans:backup.products[0].plans.map(p=>({...p,available:true}))}};
 assert.throws(()=>crud.validateCrudRequest({...edit,revision:0}));
 assert.throws(()=>crud.validateCrudRequest({...edit,product:{...edit.product,plans:[{duration:'x',price:1.2}]}}));
 await assert.rejects(()=>crud.executeProductCrud(client(true),edit),e=>e.status===503);assert.equal(writes,0);
 assert.throws(()=>crud.validateCrudRequest({...edit,product:backup.products[0]}),e=>e.status===400);
 assert.throws(()=>crud.validateCrudRequest({...edit,product:{...edit.product,plans:[{duration:'x',price:1,available:'false'}]}}),e=>e.status===400);
 const race=await Promise.allSettled([crud.executeProductCrud(client(),edit),crud.executeProductCrud(client(),edit)]);
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.status,409);
 assert.equal(rows.find(r=>r.id==='chatgpt').revision,2);
 await assert.rejects(()=>crud.executeProductCrud(client(),{operation:'delete',id:'chatgpt',revision:1}),e=>e.status===409);
 const id='11111111-1111-4111-8111-111111111111';await crud.executeProductCrud(client(),{operation:'create',id,product:backup.products[0]});
 assert.equal(rows.at(-1).sort_order,80);assert.ok(rows.at(-1).plans.every(p=>p.available===true));const n=rows.length;
 await assert.rejects(()=>crud.executeProductCrud(client(),{operation:'create',id,product:backup.products[0]}),e=>e.status===409);assert.equal(rows.length,n);
 await crud.executeProductCrud(client(),{operation:'delete',id,revision:1});assert.equal(rows.length,7);
 // Persist stock through the same Admin writer, then re-read like a fresh session.
 const stockEdit={...edit,revision:2,product:{...edit.product,plans:edit.product.plans.map((p,i)=>({...p,available:i!==0}))}};
 await crud.executeProductCrud(client(),stockEdit);
 const refreshed=await crud.executeProductCrud(client(),{operation:'list'});
 const stocked=refreshed.products.find(p=>p.id==='chatgpt');assert.equal(stocked.plans[0].available,false);assert.equal(stocked.plans[1].available,true);
 await assert.rejects(()=>crud.executeProductCrud(client(),{...edit,revision:3,product:backup.products[0]}),e=>e.status===400);
 assert.equal(rows.find(p=>p.id==='chatgpt').plans[0].available,false);
 await crud.executeProductCrud(client(),{operation:'update',id:'chatgpt',revision:3,product:stocked});
 assert.equal((await crud.executeProductCrud(client(),{operation:'list'})).products.find(p=>p.id==='chatgpt').plans[0].available,false);
 const preserved=stocked.plans.map(({available,...p})=>p);assert.deepEqual(JSON.parse(JSON.stringify(preserved)),backup.products[0].plans);
 const {NextRequest}=require('next/server');let dbCalls=0;
 function route(enabled,access){return load('src/app/admin/api/products/route.ts',{
  '@/lib/supabase/crud-flag':{productCrudEnabled:()=>enabled},'@/lib/supabase/server':{createClient:async()=>{dbCalls++;return client();}},
  '@/lib/supabase/admin-access':{checkAdminAccess:async()=>access},'@/lib/supabase/auth-request':{isSameOriginPost:r=>r.headers.get('origin')===r.nextUrl.origin},
  '@/lib/supabase/product-crud':crud}).module;}
 const req=(origin='http://localhost:3000')=>new NextRequest('http://localhost:3000/admin/api/products',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({operation:'list'})});
 assert.equal((await route(false,'admin').POST(req())).status,404);assert.equal(dbCalls,0);
 assert.equal((await route(true,'admin').POST(req('https://bad.invalid'))).status,403);assert.equal(dbCalls,0);
 for(const [access,status] of [['unauthenticated',401],['denied',403],['unavailable',503],['admin',200]])assert.equal((await route(true,access).POST(req())).status,status);
 console.log('PASS: default disabled, production target opt-in, 7/14 mapping, schema gate before writes, validation, atomic revision predicate, stale delete, UUID retry, auth/origin route gates. Mock only.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
