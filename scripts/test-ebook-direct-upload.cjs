// Fully offline browser -> Storage / metadata -> API simulation. No production writes.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const {NextRequest}=require('next/server');
function load(file,imports={},globals={}){const c={exports:{},URL,File,Response,TextDecoder,Uint8Array,Object,crypto:require('node:crypto'),require:n=>n==='server-only'?{}:n in imports?imports[n]:require(n),...globals};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,c);return c.exports;}
const model=load('src/lib/ebooks.ts'),validator=load('src/lib/supabase/testimonials.ts'),errors=load('src/lib/supabase/ebook-error.ts');
const image=load('src/lib/supabase/ebook-image.server.ts',{'../ebooks':model,'./testimonials':validator,'./ebook-error':errors});
const store=new Map(),journal=new Map(),uploads=[],requests=[];let role='admin',signedIn=true,mode='normal',apiOffline=false,downloads=0;
const storage={download:async path=>{downloads++;return {data:store.get(path)??null,error:store.has(path)?null:{code:'not-found'}};}};
const server={storage:{from:bucket=>{assert.equal(bucket,'ebook-images');return storage;}}};
const client={auth:{getUser:async()=>({data:{user:signedIn?{id:'admin-test'}:null},error:null})},rpc:async()=>({data:role==='admin',error:null}),storage:{from:bucket=>{assert.equal(bucket,'ebook-images');return {upload:async(path,file,options)=>{
 uploads.push({path,file,options});assert.equal(options.upsert,false);
 if(role!=='admin')return {error:{message:'RLS denied'}};
 if(mode==='fail-before-write')return {error:{message:'network'}};
 if(store.has(path))return {error:{message:'already exists'}};
 store.set(path,file);if(mode==='commit-then-throw')throw Error('response lost');return {data:{path},error:null};
 }};}}};
const origin=load('src/lib/supabase/auth-request.ts');
const http=load('src/lib/supabase/ebook-http.ts',{'./server':{createClient:async()=>server},'./admin-access':{checkAdminAccess:async()=>signedIn?role:'unauthenticated'},'./auth-request':origin,'./ebook-admin':errors});
const route=load('src/app/admin/api/ebooks/upload/route.ts',{'@/lib/supabase/ebook-http':http,'@/lib/supabase/ebook-error':errors,'@/lib/supabase/ebook-image.server':image});
const direct=load('src/lib/ebook-direct-upload.ts',{'./ebooks':model,'./supabase/testimonials':validator},{window:{localStorage:{getItem:key=>journal.get(key)??null,setItem:(key,v)=>journal.set(key,v)}},fetch:async(url,options)=>{
 assert.equal(url,'/admin/api/ebooks/upload');assert.equal(options.headers['Content-Type'],'application/json');assert.equal(typeof options.body,'string');assert(Buffer.byteLength(options.body)<1024);
 const metadata=JSON.parse(options.body);assert.deepEqual(Object.keys(metadata).sort(),['kind','path']);requests.push(metadata);
 if(apiOffline)throw Error('API unavailable');
 return route.POST(new NextRequest('http://localhost:3000'+url,{method:'POST',headers:{origin:'http://localhost:3000','Content-Type':'application/json'},body:options.body}));
}});
const png=size=>{const bytes=new Uint8Array(size);bytes.set([137,80,78,71,13,10,26,10]);return new File([bytes],'image.png',{type:'image/png'});};
(async()=>{
 for(const size of [4500000,4750000,5000000,5*1024*1024]){
  let path;const file=png(size);const result=await direct.uploadEbookDirect(client,file,'covers',null,p=>path=p);assert.equal(result,path);assert.equal(uploads.at(-1).file,file);assert.equal(uploads.at(-1).file.size,size);assert.equal(store.get(path).size,size);assert.equal(requests.at(-1).path,path);
  assert(direct.pendingEbookUploads().some(r=>r.path===path));direct.forgetEbookUpload(path);assert(!direct.pendingEbookUploads().some(r=>r.path===path));assert(store.has(path));
 }
 const before=uploads.length;
 for(const file of [png(5*1024*1024+1),new File(['pdf'],'book.pdf',{type:'application/pdf'}),new File(['not png'],'fake.png',{type:'image/png'}),new File([],'empty.webp',{type:'image/webp'})])await assert.rejects(()=>direct.uploadEbookDirect(client,file,'covers',null,()=>{}));
 assert.equal(uploads.length,before);
 role='denied';await assert.rejects(()=>direct.uploadEbookDirect(client,png(12),'covers',null,()=>{}),/Admin/);assert.equal(uploads.length,before);
 signedIn=false;await assert.rejects(()=>direct.uploadEbookDirect(client,png(12),'covers',null,()=>{}),/Sesi/);assert.equal(uploads.length,before);
 const path='covers/11111111-1111-4111-8111-111111111111.png';store.set(path,png(12));const d=downloads;
 await assert.rejects(()=>direct.confirmEbookUpload(path,'covers'),/Admin/);assert.equal(downloads,d);signedIn=true;
 await assert.rejects(()=>direct.confirmEbookUpload(path,'covers'),/Admin/);assert.equal(downloads,d);role='admin';
 mode='commit-then-throw';let ambiguous;await direct.uploadEbookDirect(client,png(12),'banners',null,p=>ambiguous=p);assert(store.has(ambiguous));
 mode='normal';apiOffline=true;let retry;const pendingFile=png(16);await assert.rejects(()=>direct.uploadEbookDirect(client,pendingFile,'covers',null,p=>retry=p),/Path pemulihan/);assert(store.has(retry));assert(direct.pendingEbookUploads().some(r=>r.path===retry));
 const count=store.size;apiOffline=false;await direct.uploadEbookDirect(client,pendingFile,'covers',retry,()=>{});assert.equal(store.size,count);assert.equal(uploads.at(-1).path,retry);assert.equal(uploads.at(-2).path,retry);
 const reloaded=load('src/lib/ebook-direct-upload.ts',{'./ebooks':model,'./supabase/testimonials':validator},{window:{localStorage:{getItem:key=>journal.get(key)??null,setItem:(key,v)=>journal.set(key,v)}}});assert(reloaded.pendingEbookUploads().some(r=>r.path===retry));
 mode='fail-before-write';let orphan;await assert.rejects(()=>direct.uploadEbookDirect(client,png(16),'covers',null,p=>orphan=p),/Path pemulihan/);assert(!store.has(orphan));assert(direct.pendingEbookUploads().some(r=>r.path===orphan));mode='normal';
 const bigPath='covers/22222222-2222-4222-8222-222222222222.png';store.set(bigPath,png(5*1024*1024+1));await assert.rejects(()=>image.verifyStoredEbookImage(server,bigPath,'covers'),e=>e.status===400);
 store.set(bigPath,new File(['wrong signature'],'fake.png',{type:'image/png'}));await assert.rejects(()=>image.verifyStoredEbookImage(server,bigPath,'covers'),e=>e.status===400);
 store.set(bigPath,new File([new Uint8Array([255,216,255])],'wrong.png',{type:'image/jpeg'}));await assert.rejects(()=>image.verifyStoredEbookImage(server,bigPath,'covers'),e=>e.status===400);
 for(const [name,mime,bytes]of [['jpg','image/jpeg',[255,216,255]],['webp','image/webp',[82,73,70,70,0,0,0,0,87,69,66,80]]])await direct.uploadEbookDirect(client,new File([new Uint8Array(bytes)],'image.'+name,{type:mime}),'banners',null,()=>{});
 const rejectBody=await route.POST(new NextRequest('http://localhost:3000/admin/api/ebooks/upload',{method:'POST',headers:{origin:'http://localhost:3000','Content-Type':'image/png'},body:png(5000000)}));assert.equal(rejectBody.status,415);
 for(const file of ['src/lib/ebook-direct-upload.ts','src/lib/supabase/ebook-image.server.ts','src/app/admin/api/ebooks/upload/route.ts']){const src=fs.readFileSync(file,'utf8');assert(!/\.remove\s*\(/.test(src));assert(!src.includes('sb_secret_'));}
 console.log('PASS: direct authenticated uploads 4.5/4.75/5 MB and 5 MiB, JSON-only API <1KB, server storage validation, invalid/oversize/non-admin rejection, stable retry UUID, ambiguous commits, recovery after reload, no overwrite or physical deletion. Offline mocks only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
