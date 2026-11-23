// Offline rendering and actual event-handler tests. No API or production writes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,imports={},globals={}){const context={exports:{},require:n=>(n==='./public-copy'||n==='@/components/public-copy')?require('./public-copy-test.cjs'):n in imports?imports[n]:n.endsWith('.css')?{}:require(n),...globals};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);return context.exports;}
const frame=load('src/components/public-store-frame.tsx');
const html=renderToStaticMarkup(React.createElement(frame.PublicStoreFrame,null,React.createElement('main',null,'catalog')));
assert(html.includes('data-theme="dark"'));assert(html.includes('data-storefront="public"'));
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
for(const [stored,expected]of [[null,'dark'],['invalid','dark'],['light','light'],['dark','dark']]){const element={dataset:{}};vm.runInNewContext(script,{document:{currentScript:{parentElement:element}},localStorage:{getItem:()=>stored}});assert.equal(element.dataset.theme,expected);}
// Device theme must never override the explicit public default or saved choice.
for(const systemLight of [true,false])for(const className of ['', 'eb-store', 'pd-page']){
 const markup=renderToStaticMarkup(React.createElement(frame.PublicStoreFrame,{className},React.createElement('main',null,'route')));
 assert(markup.includes('data-theme="dark"'));assert(markup.indexOf('<script>')<markup.indexOf('<main>'));
 for(const [stored,expected]of [[null,'dark'],['light','light'],['dark','dark'],['invalid','dark']]){
  const element={dataset:{theme:'dark'}};
  vm.runInNewContext(script,{document:{currentScript:{parentElement:element}},localStorage:{getItem:()=>stored},window:{matchMedia(){throw Error('Device scheme must not be queried: '+systemLight);}}});
  assert.equal(element.dataset.theme,expected);
 }
 const blocked={dataset:{theme:'dark'}};vm.runInNewContext(script,{document:{currentScript:{parentElement:blocked}},localStorage:{getItem(){throw Error('blocked');}}});assert.equal(blocked.dataset.theme,'dark');
}
const el={dataset:{}};vm.runInNewContext(script,{document:{currentScript:{parentElement:el}},localStorage:{getItem(){throw Error('blocked');}}});
const memory=new Map(),listeners={};let slot='dark',effect;
const storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
const hooks={...React,useState:initial=>[slot,value=>{slot=typeof value==='function'?value(slot):value;}],useEffect:fn=>{effect=fn;}};
const stateful=load('src/components/public-store-frame.tsx',{react:hooks},{localStorage:storage,window:{addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener:key=>delete listeners[key]}});
let tree=stateful.PublicStoreFrame({children:null});const cleanup=effect();tree=stateful.PublicStoreFrame({children:null});assert.equal(tree.props.value.theme,'dark');tree.props.value.toggle();assert.equal(memory.get(frame.PUBLIC_THEME_KEY),'light');
// New page/mount restores the same stored selection without a reload request.
slot='dark';tree=stateful.PublicStoreFrame({children:null});effect();tree=stateful.PublicStoreFrame({children:null});assert.equal(tree.props.value.theme,'light');
// A second manual toggle persists Dark, then a fresh mount restores it.
tree.props.value.toggle();assert.equal(memory.get(frame.PUBLIC_THEME_KEY),'dark');slot='dark';tree=stateful.PublicStoreFrame({children:null});effect();tree=stateful.PublicStoreFrame({children:null});assert.equal(tree.props.value.theme,'dark');
memory.set(frame.PUBLIC_THEME_KEY,'dark');listeners.storage({key:frame.PUBLIC_THEME_KEY});assert.equal(slot,'dark');storage.setItem=()=>{throw Error('blocked');};tree=stateful.PublicStoreFrame({children:null});tree.props.value.toggle();assert.equal(slot,'light');cleanup();
const Link=({children,...props})=>React.createElement('a',props,children),Image=({priority,unoptimized,sizes,...props})=>React.createElement('img',props);
const header=load('src/components/public-store-header.tsx',{'next/link':{default:Link},'next/image':{default:Image},'./public-store-frame':{PublicThemeToggle:()=>React.createElement('button',{'aria-label':'Ganti tema'})}});
const headerHtml=renderToStaticMarkup(React.createElement(header.PublicStoreHeader,{contact:'https://wa.me/6281234567890'}));
assert(headerHtml.includes('/artwork/logo-rakyatpremium.lossless.webp'));assert(headerHtml.includes('/artwork/text-rakyatpremium.lossless.webp'));assert(!headerHtml.includes('DIGITAL STORE'));assert(headerHtml.includes('https://t.me/Tst_rakprem'));assert(headerHtml.includes('https://wa.me/6281234567890'));assert(!headerHtml.includes('/admin'));
const artwork=load('src/components/catalog-artwork.tsx',{'next/image':{default:Image}});
for(const [kind,file]of [['apps','katalog-apps-transparan.lossless.webp'],['ebooks','katalog-ebook-transparan.lossless.webp']]){const out=renderToStaticMarkup(React.createElement(artwork.CatalogArtwork,{kind}));assert(out.includes('/artwork/'+file));assert(out.includes('width="2640"'));assert(out.includes('height="1485"'));}
// Real Apps handlers: keep filters/search/card routes and Analytics attributes.
const products=load('src/lib/products.ts');let values=['','Semua produk'],i=0;
const navigation=load('src/components/catalog-navigation.tsx',{'next/link':{default:Link}});
const apps=load('src/app/page.tsx',{react:{useState:()=>{const n=i++;return [values[n],v=>values[n]=v];}},'next/link':{default:Link},'@/components/product-image':{ProductImage:()=>null},'@/components/catalog-navigation':navigation,'@/lib/products':products,'@/lib/supabase/use-catalog-preview':{useCatalogPreview:()=>({state:{status:'ready',products:products.initialProducts},retry(){}})},'@/lib/supabase/use-store-settings':{useStoreSettings:()=>({settings:{number:'6281234567890'},ready:true,error:''})},'@/components/testimonial-gallery':{TestimonialGallery:()=>null},'@/components/public-store-frame':{PublicStoreFrame:({children})=>children},'@/components/public-store-header':header,'@/components/catalog-artwork':artwork});
function nodes(t){if(!t||typeof t!=='object')return [];if(typeof t.type==='function'&&t.type.name==='ProductCard')return nodes(t.type(t.props));return [t,...[t.props?.children].flat(Infinity).flatMap(nodes)];}
function render(){i=0;return nodes(apps.default());}
let treeApps=render(),cards=treeApps.filter(n=>n.props?.['data-analytics-event']==='product_click');assert.equal(cards.length,products.initialProducts.length);assert(cards.every(n=>n.props.href.startsWith('/produk/')));
treeApps.find(n=>n.type===navigation.CatalogSearch).props.onChange(products.initialProducts[0].name);cards=render().filter(n=>n.props?.['data-analytics-event']==='product_click');assert(cards.some(n=>n.props['data-analytics-product']===products.initialProducts[0].id));assert(cards.length<products.initialProducts.length);
values[0]='';const category=products.initialProducts[0].category;render().find(n=>n.type==='button'&&n.props.children===category).props.onClick();cards=render().filter(n=>n.props?.['data-analytics-event']==='product_click');assert.equal(cards.length,products.initialProducts.filter(p=>p.category===category).length);
const source=fs.readFileSync('src/app/page.tsx','utf8');assert(!source.includes('Jelajahi produk'));assert(!source.includes('Pilihan digital.'));assert(!source.includes('Pilih paket favoritmu'));
console.log('PASS: SSR default dark, pre-paint stored theme, invalid/blocked storage, toggle/persistence/remount/storage sync, shared wordmark/header links, both original artwork paths/aspect ratios, real Apps search/filter/card handlers and unchanged Analytics attributes. Offline only.');

assert(!fs.readFileSync('src/app/page.tsx','utf8').includes('Temukan premium versimu.'));

const copy=require('./public-copy-test.cjs');assert.equal(copy.translatePublic('Semua produk','en'),'All products');assert.equal(copy.translatePublic('Nama produk asli','en'),'Nama produk asli');assert.equal(copy.translatePublic('{count} produk ditemukan','en',{count:7}),'7 products found');

let serverSnapshot=true;const languageMemory=new Map(),handlers={},notifications=[];
const language=load('src/components/public-copy.tsx',{react:{...React,useSyncExternalStore:(subscribe,get,getServer)=>{subscribe(()=>notifications.push('changed'));return serverSnapshot?getServer():get();}}},{localStorage:{getItem:key=>languageMemory.get(key)??null,setItem:(key,value)=>languageMemory.set(key,value)},window:{addEventListener:(key,fn)=>handlers[key]=fn,removeEventListener:key=>delete handlers[key],dispatchEvent:event=>handlers[event.type]?.()},Event:class{constructor(type){this.type=type;}}});
languageMemory.set(language.PUBLIC_LANGUAGE_KEY,'en');assert.equal(language.PublicLanguageRoot({children:null}).props.lang,'id');serverSnapshot=false;assert.equal(language.PublicLanguageRoot({children:null}).props.lang,'en');assert.equal(language.PublicText({text:'Semua produk'}).props.children,'All products');language.setPublicLanguage('id');assert.equal(languageMemory.get(language.PUBLIC_LANGUAGE_KEY),'id');assert.equal(language.PublicLanguageSwitcher().props.value,'id');language.setPublicLanguage('en');assert.equal(language.PublicLanguageRoot({children:null}).props.lang,'en');assert(notifications.length);console.log('PASS: ID/EN default SSR, saved EN restoration, dictionary/counts, actual language change handlers and local persistence; product-name fallback unchanged.');

console.log("PASS: system Light/Dark ignored, all public frame variants default Dark, bootstrap precedes content, saved Light preserved, manual Dark toggle persisted/remounted. Offline assertions; browser paint/hydration not verified.");
