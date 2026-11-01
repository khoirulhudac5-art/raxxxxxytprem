// Offline mocks only: no requests to Supabase, no real account or product writes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {NextRequest}=require('next/server');
function load(file,imports={}){const context={exports:{},URL,File,TextDecoder,Uint8Array,Object,require:n=>n==='server-only'?{}:n in imports?imports[n]:n.endsWith('.css')?{}:require(n)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);return context.exports;}
const model=load('src/lib/ebooks.ts');
const testimonial=load('src/lib/supabase/testimonials.ts');
const errors=load('src/lib/supabase/ebook-error.ts');
const imageServer=load('src/lib/supabase/ebook-image.server.ts',{'../ebooks':model,'./testimonials':testimonial,'./ebook-error':errors});
const crud=load('src/lib/supabase/ebook-admin.ts',{'../ebooks':model,'./ebook-error':errors,'./ebook-image.server':imageServer});
const auth=load('src/lib/supabase/auth-request.ts');
const id='11111111-1111-4111-8111-111111111111',cat='22222222-2222-4222-8222-222222222222';
const image='covers/33333333-3333-4333-8333-333333333333.png';
const payload={slug:'book-one',title:'One',description:'Description',category_id:cat,cover_path:image,is_free:true,price:0,free_download_url:'https://drive.google.com/file/d/example/view',is_published:true,sort_order:10};
const db={ebooks:[],ebook_categories:[{id:cat,slug:'category',name:'Category',is_active:true,sort_order:10,revision:1}],ebook_settings:[{id:'main',banner_path:null,banner_alt:'',banner_enabled:false,revision:1}]};
const uploads=[],stored=new Map();
stored.set(image,new File([new Uint8Array([137,80,78,71,13,10,26,10])],'image.png',{type:'image/png'}));
stored.set('banners/33333333-3333-4333-8333-333333333333.webp',new File([new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80])],'image.webp',{type:'image/webp'}));
let writes=0,reads=0;
function client(){return {from(table){assert(Object.hasOwn(db,table));let op='read',value,filters={};const q={select(){return q;},order(){return q;},eq(k,v){filters[k]=v;return q;},insert(v){op='create';value=v;return q;},update(v){op='update';value=v;return q;},delete(){op='delete';return q;},single:async()=>{const r=apply();return r.error?r:{data:r.data[0],error:null};},then(a,b){return Promise.resolve(apply()).then(a,b);}};
 function apply(){reads++;const rows=db[table];let matches=rows.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
  if(op==='create'){writes++;if(rows.some(r=>r.id===value.id||r.slug===value.slug))return {error:{code:'23505'}};const r={...structuredClone(value),revision:1};rows.push(r);return {data:[structuredClone(r)]};}
  if(op==='update'||op==='delete'){
   if(table==='ebook_categories'&&op==='delete'&&matches.some(c=>db.ebooks.some(b=>b.category_id===c.id)))return {error:{code:'23503'}};
   if(op==='update'&&matches.some(r=>value.slug!==undefined&&r.slug!==value.slug))return {error:{code:'P0001'}};
   writes++;const out=matches.map(r=>({...r,...(op==='update'?structuredClone(value):{}),revision:op==='update'?r.revision+1:r.revision}));
   if(op==='delete')db[table]=rows.filter(r=>!matches.includes(r));else for(const r of out)Object.assign(rows.find(x=>x.id===r.id),r);
   return {data:structuredClone(out)};
  }return {data:structuredClone(matches)};
 }return q;},storage:{from(bucket){assert.equal(bucket,'ebook-images');return {download:async path=>({data:stored.get(path)??null,error:stored.has(path)?null:{code:'not-found'}}),upload:async()=>{throw Error('Server must not upload file bytes');},getPublicUrl:path=>({data:{publicUrl:'https://example.com/'+path}})};}}};}
const request=(body,{origin='http://localhost:3000',type='application/json',path='/admin/api/ebooks'}={})=>new NextRequest('http://localhost:3000'+path,{method:'POST',headers:{origin,'Content-Type':type},body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)});
let access='admin',connections=0;
const http=load('src/lib/supabase/ebook-http.ts',{'./server':{createClient:async()=>{connections++;return client();}},'./admin-access':{checkAdminAccess:async()=>access},'./auth-request':auth,'./ebook-admin':crud});
const route=load('src/app/admin/api/ebooks/route.ts',{'@/lib/supabase/ebook-http':http,'@/lib/supabase/ebook-admin':crud});
const upload=load('src/app/admin/api/ebooks/upload/route.ts',{'@/lib/supabase/ebook-http':http,'@/lib/supabase/ebook-admin':crud,'@/lib/supabase/ebook-error':errors,'@/lib/supabase/ebook-image.server':imageServer});
async function run(){
 assert.equal((await crud.executeEbookAdmin(client(),{operation:'list'})).categories.length,1);
 assert.throws(()=>crud.validateEbookRequest({operation:'create',entity:'__proto__',id,data:payload}));
 for(const fields of [{is_free:false,price:20000},{price:1},{is_free:false,price:0,free_download_url:null},{free_download_url:'javascript:alert(1)'},{free_download_url:'https://user:password@example.com/book.pdf'},{cover_path:'../old.png'},{sort_order:-1},{is_published:'true'},{category_id:'bad'}])assert.throws(()=>crud.validateEbookRequest({operation:'create',entity:'ebook',id,data:{...payload,...fields}}));
 assert.equal(writes,0);
 const create={operation:'create',entity:'ebook',id,data:{...payload,admin:true,revision:999}};
 await crud.executeEbookAdmin(client(),create);assert.equal(db.ebooks[0].revision,1);assert(!('admin' in db.ebooks[0]));
 const update={operation:'update',entity:'ebook',id,revision:1,data:{...payload,title:'Updated',is_free:false,price:25000,free_download_url:null}};
 const race=await Promise.allSettled([crud.executeEbookAdmin(client(),update),crud.executeEbookAdmin(client(),update)]);
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.status,409);
 assert.equal(db.ebooks[0].revision,2);
 const refreshed=await crud.executeEbookAdmin(client(),{operation:'list'});assert.equal(refreshed.ebooks[0].price,25000);assert.equal(refreshed.ebooks[0].free_download_url,null);
 await assert.rejects(()=>crud.executeEbookAdmin(client(),{operation:'delete',entity:'ebook',id,revision:1}),e=>e.status===409);
 await assert.rejects(()=>crud.executeEbookAdmin(client(),{operation:'delete',entity:'category',id:cat,revision:1}),e=>e.status===409);
 await assert.rejects(()=>crud.executeEbookAdmin(client(),{...update,revision:2,data:{...update.data,slug:'changed'}}),e=>e.status===400);
 await crud.executeEbookAdmin(client(),{operation:'update',entity:'category',id:cat,revision:1,data:{slug:'category',name:'Renamed',is_active:false,sort_order:20}});
 assert.equal((await crud.executeEbookAdmin(client(),{operation:'list'})).categories[0].is_active,false);
 const settings={operation:'update',entity:'settings',id:'main',revision:1,data:{banner_path:'banners/33333333-3333-4333-8333-333333333333.webp',banner_alt:'Banner',banner_enabled:true}};
 await crud.executeEbookAdmin(client(),settings);await assert.rejects(()=>crud.executeEbookAdmin(client(),settings),e=>e.status===409);
 await assert.rejects(()=>crud.executeEbookAdmin(client(),{...settings,revision:2,data:{...settings.data,banner_alt:''}}),e=>e.status===400);
 db.ebooks[0].free_download_url='https://example.com/paid.pdf';await assert.rejects(()=>crud.executeEbookAdmin(client(),{operation:'list'}),e=>e.status===503);db.ebooks[0].free_download_url=null;
 await crud.executeEbookAdmin(client(),{operation:'delete',entity:'ebook',id,revision:2});assert.equal(db.ebooks.length,0);
 await crud.executeEbookAdmin(client(),{operation:'delete',entity:'category',id:cat,revision:2});assert.equal(db.ebook_categories.length,0);
 const before=writes;
 for(const [role,status] of [['unauthenticated',401],['denied',403],['unavailable',503]]){access=role;assert.equal((await route.POST(request(create))).status,status);assert.equal((await upload.POST(request('data',{type:'image/png',path:'/admin/api/ebooks/upload?kind=covers'}))).status,status);}
 assert.equal(writes,before);assert.equal(uploads.length,0);access='admin';
 const n=connections;assert.equal((await route.POST(request(create,{origin:'https://bad.example'}))).status,403);assert.equal(connections,n);
 assert.equal((await route.POST(request('{invalid'))).status,400);
 assert.equal((await route.POST(request('x'.repeat(65537)))).status,413);
 assert.equal((await route.POST(request('x',{type:'text/plain'}))).status,415);
 let response=await route.POST(request({operation:'list'}));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 const up=(data,type='application/json')=>upload.POST(request(data,{type,path:'/admin/api/ebooks/upload'}));
 assert.equal((await up({path:image,kind:'covers'})).status,200);
 assert.equal((await up('binary','image/png')).status,415);
 assert.equal((await up('x'.repeat(1025))).status,413);
 assert.equal((await up({path:'../x.png',kind:'covers'})).status,400);
 assert.equal((await up({path:image,kind:'banners'})).status,400);
 assert.equal((await up({path:image,kind:'covers',bytes:'not allowed'})).status,400);
 assert.equal((await up({path:'covers/99999999-9999-4999-8999-999999999999.png',kind:'covers'})).status,503);
 const previous=stored.get(image);stored.set(image,new File(['not a real PNG'],'bad.png',{type:'image/png'}));
 assert.equal((await up({path:image,kind:'covers'})).status,400);
 const beforeInvalid=writes;
 await assert.rejects(()=>crud.executeEbookAdmin(client(),create),e=>e.status===400);assert.equal(writes,beforeInvalid);
 stored.set(image,previous);assert.equal(uploads.length,0);
 const page=fs.readFileSync('src/app/admin/ebooks/page.tsx','utf8');assert(page.includes('checkAdminAccess'));assert(page.includes("redirect('/admin/login')"));
 assert(fs.readFileSync('src/components/admin-workspace.tsx','utf8').includes('href="/admin/ebooks"'));
 for(const p of ['src/lib/supabase/ebook-admin.ts','src/app/admin/api/ebooks/upload/route.ts','src/components/ebook-image-upload.tsx']){const src=fs.readFileSync(p,'utf8');assert(!/\.remove\s*\(/.test(src));assert(!src.includes('service_role'));}
 console.log('PASS: e-book/category/banner CRUD, revision races and stale delete, FK restriction, paid URL protection, whitelist validation, auth/origin/body limits, metadata-only confirmation, server file validation on Save, immutable uploads and retained shared files. Offline mocks only.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
