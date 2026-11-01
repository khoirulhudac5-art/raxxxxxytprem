// Exercise actual editor event handlers with local hook/fetch mocks; no network.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
function load(file,imports={},globals={}){const c={exports:{},URL,require:n=>n in imports?imports[n]:n.endsWith('.css')?{}:require(n),...globals};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,c);return c.exports;}
const model=load('src/lib/ebooks.ts');const categoryId='22222222-2222-4222-8222-222222222222';
let data={ebooks:[],categories:[{id:categoryId,slug:'category',name:'Category',is_active:true,revision:1,sort_order:10}],settings:{id:'main',banner_path:null,banner_alt:'',banner_enabled:false,revision:1}};
let slots=[],index=0,conflict=false;const calls=[],forgotten=[];
const react={useEffect(){},useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef(initial){const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i];}};
function ImageStub(){};
const manager=load('src/components/ebook-manager.tsx',{react,'next/link':()=>null,'./header':{Header:()=>null},'./ebook-image-upload':{EbookImageUpload:ImageStub},'@/lib/ebook-direct-upload':{forgetEbookUpload:path=>forgotten.push(path)},'@/lib/ebooks':model,'@/lib/products':{rupiah:n=>'Rp '+n}}, {
 crypto:require('node:crypto'),window:{confirm:()=>true},fetch:async(_,options)=>{
  const input=JSON.parse(options.body);calls.push(input);
  if(input.operation==='list')return {ok:true,json:async()=>structuredClone(data)};
  if(conflict)return {ok:false,json:async()=>({error:'Data sudah berubah. Muat ulang.'})};
  if(input.entity==='ebook'){const saved={...input.data,revision:(input.revision??0)+1};if(input.operation==='create')data.ebooks.push(saved);else data.ebooks=data.ebooks.map(e=>e.id===input.id?saved:e);}
  if(input.entity==='settings')data.settings={...input.data,revision:input.revision+1};
  if(input.entity==='category')data.categories=data.categories.map(c=>c.id===input.id?{...input.data,revision:input.revision+1}:c);
  return {ok:true,json:async()=>({saved:{id:input.id}})};
 }
});
function nodes(t){if(!t||typeof t!=='object')return [];return [t,...[t.props?.children].flat(Infinity).flatMap(nodes)];}
function text(t){if(typeof t==='string'||typeof t==='number')return ''+t;if(!t||typeof t!=='object')return '';return [t.props?.children].flat(Infinity).map(text).join(' ');}
function render(){index=0;return nodes(manager.EbookManager());}
function button(name){const node=render().find(n=>n.type==='button'&&text(n).trim()===name);assert(node,'Button missing: '+name);return node;}
function field(label,type='input'){const l=render().find(n=>n.type==='label'&&text(n).trim().startsWith(label));assert(l,'Label missing: '+label);return nodes(l).find(n=>n.type===type);}
function change(label,value,type='input'){const n=field(label,type);assert(n);n.props.onChange({target:{value}});}
async function submit(){render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});const pending=render();assert(pending.some(n=>n.type==='button'&&n.props['aria-busy']===true));assert(pending.some(n=>n.props?.className==='ui-spinner'&&n.props['data-active']===true));await new Promise(setImmediate);assert(!render().some(n=>n.type==='button'&&n.props['aria-busy']===true));}
(async()=>{
 render();slots[0]=structuredClone(data);
 button('Tambah e-book').props.onClick();change('Judul','Belajar AI');assert.equal(field('Slug').props.value,'belajar-ai');
 change('Link download','https://example.com/free.pdf');change('Jenis','paid','select');assert(!render().some(n=>n.type==='input'&&n.props.type==='url'));change('Harga',45000);
 const image=render().find(n=>n.type===ImageStub);image.props.onChange('covers/33333333-3333-4333-8333-333333333333.png');
 image.props.onPending(true);assert.equal(button('Simpan e-book').props.disabled,true);image.props.onPending(false);
 change('Status','published','select');await submit();let saved=calls.find(c=>c.operation==='create');assert.equal(saved.data.price,45000);assert.equal(saved.data.free_download_url,null);assert.equal(saved.data.category_id,categoryId);assert.equal(saved.data.is_published,true);assert.equal(forgotten.length,1);assert.equal(forgotten[0],saved.data.cover_path);
 button('Edit').props.onClick();assert.equal(field('Slug').props.readOnly,true);assert.equal(field('Harga').props.value,45000);
 conflict=true;change('Judul','Draft dipertahankan');await submit();assert.equal(field('Judul').props.value,'Draft dipertahankan');assert(render().some(n=>n.props?.role==='alert'&&text(n).includes('Data sudah berubah')));assert.equal(forgotten.length,1);conflict=false;button('Batal').props.onClick();
 button('Kategori').props.onClick();assert.equal(button('Hapus').props.disabled,true);button('Edit').props.onClick();change('Status','inactive','select');await submit();assert.equal(data.categories[0].is_active,false);
 button('Banner').props.onClick();button('Edit banner').props.onClick();render().find(n=>n.type===ImageStub).props.onChange('banners/44444444-4444-4444-8444-444444444444.webp');change('Teks alternatif','Banner e-book');change('Status banner','active','select');await submit();assert.equal(data.settings.banner_enabled,true);assert.equal(data.settings.revision,2);assert.equal(forgotten.at(-1),data.settings.banner_path);
 button('Edit banner').props.onClick();assert.equal(field('Teks alternatif').props.value,'Banner e-book');assert.equal(render().find(n=>n.type===ImageStub).props.value,data.settings.banner_path);
 console.log('PASS: real editor handlers, slug/default category, paid URL cleared, selected image/pending upload, save/refresh, immutable edit slug, conflict keeps draft, used-category delete blocked, category status, banner upload reference/activation/reopen. Offline only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
