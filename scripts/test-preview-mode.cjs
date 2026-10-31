// Render tests without browser, credentials, network, or storage writes.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function compile(path,imports,environment='development') {
 const ctx={exports:{},URLSearchParams,process:{env:{NODE_ENV:environment}},require:name=>name in imports?imports[name]:require(name)};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,ctx);
 return ctx.exports;
}
const mode=compile('src/lib/supabase/preview-mode.ts',{});
for(const env of ['production','test',undefined])assert.equal(mode.isSupabasePreview('?source=supabase-preview',env),false);
assert.equal(mode.isSupabasePreview('?source=supabase-preview','development'),true);
for(const query of ['', '?source=supabase','?preview=true'])assert.equal(mode.isSupabasePreview(query,'development'),false);
const model=compile('src/lib/products.ts',{});
const whatsapp=compile('src/lib/whatsapp.ts',{'./config':{storeConfig:{whatsappNumber:''}},'./products':model});
const catalog=compile('src/lib/supabase/catalog.ts',{'../products':model});
const products=JSON.parse(fs.readFileSync('rakyat-premium-backup-2026-10-30T09-05-23-204Z.json','utf8')).products;
function render(activeMode,status='ready',environment='development') {
 let call=0,observed;
 const states=[activeMode,'','Semua produk'];
 const page=compile('src/app/page.tsx',{
  react:{...React,useState:initial=>[call<states.length?states[call++]:initial,()=>{}],useEffect:()=>{}},
  '@/components/header':{Header:()=>React.createElement('header')},
  '@/components/product-image':{ProductImage:({product})=>React.createElement('span',{'data-product-image':product.id})},
  '@/lib/products':model,
  '@/lib/use-products':{useProducts:()=>({products:activeMode==='local'?products:[{...products[0],name:'LOCAL MUST NOT LEAK'}],ready:true,error:''})},
  '@/lib/use-whatsapp-settings':{useWhatsAppSettings:()=>({ready:true,settings:{number:'6281234567890',template:'{produk} {durasi} {harga}'}})},
  '@/lib/whatsapp':whatsapp,
  '@/lib/supabase/catalog':catalog,
  '@/lib/supabase/preview-mode':mode,
  '@/lib/supabase/use-catalog-preview':{useCatalogPreview:(enabled,order)=>{observed={enabled,order};return {state:{status,products:status==='ready'?products:[],error:status==='error'?'Produk Supabase gagal dibaca.':null},retry:()=>{}};}},
 },environment);
 return {html:renderToStaticMarkup(React.createElement(page.default)),observed};
}
const normal=render('local');assert.equal(normal.observed.enabled,false);assert.ok(!normal.html.includes('Preview Supabase (development)'));
const preview=render('preview');assert.equal(preview.observed.enabled,true);assert.ok(preview.html.includes('Preview Supabase (development)'));assert.ok(!preview.html.includes('LOCAL MUST NOT LEAK'));
const cards=html=>html.match(/<article class="product-card">[\s\S]*?<\/article>/g)??[];
assert.equal(cards(preview.html).length,7);assert.deepEqual(cards(normal.html),cards(preview.html));
assert.equal((preview.html.match(/type="radio"/g)??[]).length,14);
for(const status of ['error','empty','loading','idle']){
 const html=render('preview',status).html;
 assert.equal(cards(html).length,0);assert.ok(!html.includes('LOCAL MUST NOT LEAK'));
 if(status==='error')assert.ok(html.includes('Preview gagal dimuat')&&html.includes('Coba lagi'));
 if(status==='empty')assert.ok(html.includes('Belum ada produk yang terlihat')&&html.includes('Coba lagi'));
}
assert.equal(render('local','ready','production').observed.enabled,false);
console.log('PASS: development-only URL gate; normal tidak memanggil preview; markup 7 kartu dan 14 paket sama; loading/error/empty tanpa fallback serta retry. Uji render/mock, bukan browser end-to-end.');
