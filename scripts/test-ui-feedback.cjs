// Offline rendering/state tests: no Auth calls, network, uploads or production writes.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,imports={}){const c={exports:{},URL,require:n=>n in imports?imports[n]:n.endsWith('.css')?{}:require(n)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,c);return c.exports;}
const skeleton=load('src/components/detail-skeleton.tsx');
for(const kind of ['app','ebook']){
 const html=renderToStaticMarkup(React.createElement(skeleton.DetailSkeleton,{kind}));assert(html.includes('aria-busy="true"'));assert(html.includes('role="status"'));assert(html.includes('ui-skeleton-title'));assert(html.includes('ui-skeleton-price'));assert(html.includes('ui-skeleton-button'));assert(!/<button|<input|<a\s/.test(html));
}
const model=load('src/lib/products.ts');const wa=load('src/lib/whatsapp.ts',{'./products':model,'./config':{storeConfig:{whatsappNumber:''}}});let status='loading',retries=0;
const Link=({children,...props})=>React.createElement('a',props,children);
const detail=load('src/components/product-detail.tsx',{'next/link':{default:Link},'next/image':{default:()=>null},'./product-image':{ProductImage:()=>null},'./detail-skeleton':skeleton,'@/lib/products':model,'@/lib/whatsapp':wa,'@/lib/supabase/use-catalog-preview':{useCatalogPreview:()=>({state:{status,products:status==='ready'?[model.initialProducts[0]]:[]},retry:()=>retries++})},'@/lib/supabase/use-store-settings':{useStoreSettings:()=>({ready:true,error:'',settings:{number:'6281234567890',template:'{produk} {durasi} {harga}'}})}});
const render=()=>renderToStaticMarkup(React.createElement(detail.ProductDetail,{slug:'chatgpt-plus'}));
for(status of ['idle','loading'])assert(render().includes('ui-detail-skeleton'));
status='error';let html=render();assert(!html.includes('ui-detail-skeleton'));assert(html.includes('Produk belum dapat dimuat'));assert(html.includes('Coba lagi'));
status='ready';html=render();assert(!html.includes('ui-detail-skeleton'));assert(html.includes('ChatGPT Plus'));
const ebookLoading=load('src/app/ebook/[slug]/loading.tsx',{'@/components/detail-skeleton':skeleton}).default;
assert(renderToStaticMarkup(React.createElement(ebookLoading)).includes('ui-skeleton-ebook-visual'));
const ebookError=load('src/app/ebook/error.tsx').default;html=renderToStaticMarkup(React.createElement(ebookError,{reset:()=>retries++}));assert(!html.includes('ui-detail-skeleton'));assert(html.includes('role="alert"'));assert(html.includes('Coba lagi'));
const catalogLoading=load('src/app/ebook/loading.tsx',{'@/components/detail-skeleton':skeleton}).default;assert(renderToStaticMarkup(React.createElement(catalogLoading)).includes('ui-catalog-skeleton'));
let index=0;const upload=load('src/components/ebook-image-upload.tsx',{react:{useState:initial=>{const i=index++;return [i===3?true:initial,()=>{}];},useRef:()=>({current:null}),useEffect:()=>{}},'@/lib/supabase/client':{createClient:()=>{throw Error('Render must not upload');}},'@/lib/supabase/testimonials':{},'@/lib/ebooks':{EBOOK_BUCKET:'ebook-images'},'@/lib/ebook-direct-upload':{pendingEbookUploads:()=>[]}});
html=renderToStaticMarkup(React.createElement(upload.EbookImageUpload,{kind:'covers',value:null,onChange(){},onBusy(){},onPending(){},disabled:false}));assert(html.includes('ui-spinner'));assert(html.includes('aria-busy="true"'));assert(html.includes('Memproses gambar di Storage'));assert(!html.includes('%'));
const css=fs.readFileSync('src/app/ui-feedback.css','utf8');assert(css.includes('180ms'));assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('animation:none!important'));assert(css.includes('transform:translateX'));assert(css.includes('transform:rotate'));assert(!css.includes('will-change'));assert(!css.includes('from{opacity:0}'));
const tabs=fs.readFileSync('src/components/catalog-navigation.tsx','utf8');assert(!/setTimeout|requestAnimationFrame|preventDefault|window\.location|router\.push/.test(tabs));assert(fs.readFileSync('src/app/page.tsx','utf8').includes('<main className="ui-route-enter">'));assert(fs.readFileSync('src/components/ebook-catalog.tsx','utf8').includes('eb-shell eb-main ui-route-enter'));
console.log('PASS: layout-shaped accessible skeletons, loading -> ready/error replacement, e-book boundaries, real busy spinner without fake percentage, 180ms CSS entry, compositor-only shimmer/spinner, reduced-motion and no navigation delay. Offline only.');
