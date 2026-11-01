// Local mock-render regression: catalog routing and detail stock/WhatsApp behavior.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
function load(p,imports={}){const c={exports:{},URL,require:n=>n in imports?imports[n]:n.endsWith('.css')?{}:require(n)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,c);return c.exports;}
const model=load('src/lib/products.ts'),wa=load('src/lib/whatsapp.ts',{'./products':model,'./config':{storeConfig:{whatsappNumber:''}}});
let selected=0;
const imports={react:{useState:initial=>[selected,value=>selected=value]},'next/image':()=>null,'next/link':()=>null,'./product-image':{ProductImage:()=>null},'./detail-skeleton':load('src/components/detail-skeleton.tsx'),'@/lib/products':model,'@/lib/whatsapp':wa,'@/lib/supabase/use-catalog-preview':{},'@/lib/supabase/use-store-settings':{}};
const detail=load('src/components/product-detail.tsx',imports);
function nodes(t){if(!t||typeof t!=='object')return [];return [t,...[t.props?.children].flat(Infinity).flatMap(nodes)];}
function text(t){if(typeof t==='string'||typeof t==='number')return ''+t;if(!t||typeof t!=='object')return '';return [t.props?.children].flat(Infinity).map(text).join(' ');}
const product={...model.initialProducts[1],plans:[{duration:'1 bulan',price:25000},{duration:'3 bulan',price:65000}]};const settings={number:'6281234567890',template:'{produk}|{durasi}|{harga}'};
assert.equal(model.productSlug(product,[product]),'capcut-pro');const duplicate={...product,id:'other'};assert.notEqual(model.productSlug(product,[product,duplicate]),model.productSlug(duplicate,[product,duplicate]));
function render(){return nodes(detail.ProductPackages({product,settings,settingsReady:true}));}
let n=render();assert.equal(n.filter(x=>x.type==='input')[0].props.checked,true);n.filter(x=>x.type==='input')[1].props.onChange();n=render();let link=n.find(x=>x.type==='a');assert.ok(new URL(link.props.href).searchParams.get('text').includes('3 bulan'));assert.ok(new URL(link.props.href).searchParams.get('text').includes(model.rupiah(65000)));
product.plans[1].available=false;n=render();assert.equal(n.filter(x=>x.type==='input')[1].props.disabled,true);assert.equal(n.filter(x=>x.type==='input')[0].props.checked,true);assert.ok(text(n.find(x=>x.type==='label'&&x.props.className.includes('sold-out'))).includes('Habis'));
product.plans[0].available=false;n=render();assert.ok(!n.some(x=>x.type==='a'));assert.ok(n.some(x=>x.type==='button'&&x.props.disabled&&text(x)==='Stok Habis'));
product.plans[1].available=true;selected=0;n=render();assert.equal(n.filter(x=>x.type==='input')[1].props.checked,true);
imports['@/lib/supabase/use-catalog-preview'].useCatalogPreview=()=>({state:{status:'ready',products:[product]},retry:()=>{}});imports['@/lib/supabase/use-store-settings'].useStoreSettings=()=>({settings,ready:true});assert.ok(text(detail.ProductDetail({slug:'not-found'})).includes('Produk tidak ditemukan'));assert.ok(nodes(detail.ProductDetail({slug:'capcut-pro'})).some(x=>x.props?.href==='/#katalog'));
console.log('PASS: product slugs, duplicate names, one selected plan, prices and WhatsApp, unavailable fallback/disabled/all sold out, missing product and catalog return. Mock only.');
