// Local-only fixtures/gates/route tests; never connects to Supabase.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');const {NextRequest}=require('next/server');
let fixtureReads=0;
const fixture={version:1,categories:[{id:'test',name:'Test category'}],books:['canva.svg','ai.svg','marketing.svg','design.svg'].map((asset,i)=>({id:String(i),slug:'preview-'+i,title:'Preview Book '+(i+1),description:'Local test fixture',categoryId:'test',category:'Test category',isFree:i===0||i===3,price:i===1?15000:i===2?25000:0,asset}))};
function load(file,environment,imports={}){const c={exports:{},URL,Response,process:{env:{NODE_ENV:environment},cwd:()=>process.cwd()},require:n=>n==='server-only'?{}:n==='node:fs/promises'?{readFile:async file=>{fixtureReads++;return file.endsWith('/catalog.json')?JSON.stringify(fixture):'<svg xmlns="http://www.w3.org/2000/svg"/>';}}:n in imports?imports[n]:require(n)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,c);return c.exports;}
const file='src/lib/ebook-local-preview.server.ts';
(async()=>{
 const dev=load(file,'development'),prod=load(file,'production');
 for(const env of ['production','test',undefined])for(const host of ['localhost:3000','127.0.0.1','[::1]:3000'])assert.equal(dev.localEbookPreviewAllowed(env,host,'local-ebooks'),false);
 for(const host of [null,'rakyatpremium.digital','localhost.attacker.com','localhost:3000@evil.com','evil.localhost','localhost/path'])assert.equal(dev.localEbookPreviewAllowed('development',host,'local-ebooks'),false);
 for(const mode of [undefined,'','local-ebooks-other',['local-ebooks']])assert.equal(dev.localEbookPreviewAllowed('development','localhost:3000',mode),false);
 const n=fixtureReads;assert.equal(await prod.readLocalEbookPreview('local-ebooks','localhost:3000'),null);assert.equal(await prod.readLocalEbookAsset('banner.svg'),null);assert.equal(fixtureReads,n);
 assert.equal(await dev.readLocalEbookPreview('local-ebooks','rakyatpremium.digital'),null);assert.equal(await dev.readLocalEbookPreview(undefined,'localhost:3000'),null);assert.equal(fixtureReads,n);
 const data=await dev.readLocalEbookPreview('local-ebooks','localhost:3000');assert.equal(data.books.length,4);assert.equal(data.books.filter(b=>b.isFree).length,2);assert.deepEqual(Array.from(data.books.filter(b=>!b.isFree).map(b=>b.price)),[15000,25000]);assert(data.books.every(b=>!('downloadUrl' in b)&&!('free_download_url' in b)));
 assert((await dev.readLocalEbookAsset('canva.svg')).startsWith('<svg'));assert.equal(await dev.readLocalEbookAsset('../catalog.json'),null);
 const routeFile='src/app/ebook/preview-assets/[asset]/route.ts';
 const req=host=>new NextRequest('http://localhost:3000/ebook/preview-assets/banner.svg?preview=local-ebooks',{headers:{host}});
 const params={params:Promise.resolve({asset:'banner.svg'})};
 const devRoute=load(routeFile,'development',{'@/lib/ebook-local-preview.server':dev});const prodRoute=load(routeFile,'production',{'@/lib/ebook-local-preview.server':prod});
 assert.equal((await prodRoute.GET(req('localhost:3000'),params)).status,404);assert.equal((await devRoute.GET(req('rakyatpremium.digital'),params)).status,404);assert.equal((await devRoute.GET(req('localhost:3000'),params)).status,200);
 const Link=({children,...p})=>React.createElement('a',p,children);let databaseReads=0;
 const catalog=load('src/app/ebook/page.tsx','development',{'next/headers':{headers:async()=>new Headers({host:'localhost:3000'})},'@/lib/ebook-local-preview.server':dev,'@/components/ebook-preview-notice':{EbookPreviewNotice:()=>React.createElement('aside',null,'PREVIEW LOKAL')},'@/components/ebook-catalog':{EbookCatalog:props=>React.createElement('p',null,props.books.map(b=>b.title).join('|'))},'@/lib/supabase/ebook-public.server':{readPublicEbooks:async()=>{databaseReads++;return {books:[]};}}});
 assert(renderToStaticMarkup(await catalog.default({searchParams:Promise.resolve({preview:'local-ebooks'})})).includes('Preview Book 1'));assert.equal(databaseReads,0);
 const purchase=load('src/components/ebook-purchase.tsx','development',{'@/lib/supabase/use-store-settings':{useStoreSettings:()=>{throw Error('Preview must not read real WhatsApp settings');}},'@/lib/ebook-public':{}});
 for(const book of data.books){const html=renderToStaticMarkup(React.createElement(purchase.EbookPurchase,{book,downloadUrl:null,preview:true}));assert(html.includes('disabled'));assert(html.includes(book.isFree?'Download Gratis':'Beli via WhatsApp'));assert(!html.includes('href='));}
 console.log('PASS: explicit dev/loopback/query gate, production reads zero fixtures, assets whitelist, 4 local books and prices, no Supabase read on preview, simulated purchase buttons have no external links.');
})().catch(e=>{console.error(e);process.exitCode=1;});
