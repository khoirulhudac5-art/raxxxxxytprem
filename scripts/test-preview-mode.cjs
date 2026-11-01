// Current public page is Supabase-backed in every environment. Mock SSR only.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function compile(p,imports={}){const c={exports:{},require:n=>n in imports?imports[n]:n.endsWith('.css')?{}:require(n)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,c);return c.exports;}
const model=compile('src/lib/products.ts');const wa=compile('src/lib/whatsapp.ts',{'./products':model,'./config':{storeConfig:{whatsappNumber:''}}});
const products=JSON.parse(fs.readFileSync('rakyat-premium-backup-2026-10-30T09-05-23-204Z.json')).products;
function render(status='ready',rows=products){let enabled=false;const Page=compile('src/app/page.tsx',{
 react:{...React,useEffect:()=>{}},'next/image':{default:()=>null},'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
 '@/components/product-image':{ProductImage:()=>null},'@/components/testimonial-gallery':{TestimonialGallery:()=>null},'@/lib/products':model,'@/lib/whatsapp':wa,
 '@/lib/supabase/use-store-settings':{useStoreSettings:()=>({settings:{number:'6281234567890',template:'{produk} {durasi} {harga}'},ready:true,error:''})},
 '@/lib/supabase/use-catalog-preview':{useCatalogPreview:value=>{enabled=value;return {state:{status,products:status==='ready'?rows:[],error:status==='error'?'Gagal':null},retry:()=>{}};}}
 }).default;return {html:renderToStaticMarkup(React.createElement(Page)),enabled};}
const ready=render();assert.equal(ready.enabled,true);assert.equal((ready.html.match(/class="rp-card rp-card-3d /g)||[]).length,7);assert.equal((ready.html.match(/type="radio"/g)||[]).length,0);assert.equal((ready.html.match(/href="\/produk\//g)||[]).length,7);assert.ok(!ready.html.includes('rp-quick-plan'));
for(const status of ['loading','idle','empty','error'])assert.equal((render(status).html.match(/class="rp-card rp-card-3d /g)||[]).length,0);
const sold=products.map(p=>({...p,plans:p.plans.map(plan=>({...plan,available:false}))}));const html=render('ready',sold).html;assert.ok(!html.includes('rp-catalog-from'));assert.ok(!html.includes('rp-catalog-stock'));assert.ok((html.match(/<article[\s\S]*?<\/article>/g)||[]).every(card=>!card.includes('href="https://wa.me/')));
assert.ok(!ready.html.includes('Mulai <strong>'));assert.ok(!ready.html.includes('rp-catalog-from'));
assert.ok(render('ready',[{...products[0],color:'red'}]).html.includes('--card-accent:208 113 130'));
assert.ok(render('ready',[{...products[0],color:'green'}]).html.includes('--card-accent:109 184 161'));
console.log('PASS: Supabase-only public SSR, 7 linked cards with no package controls, empty/loading/error without local fallback, no prices/stock/package controls on cards, saved-color accent restored. No network.');
