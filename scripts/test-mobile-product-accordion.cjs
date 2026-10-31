// Mock-render tests only: no live Supabase or WhatsApp requests.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(path,imports={}){const c={exports:{},URL,require:n=>n in imports?imports[n]:require(n)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,c);return c.exports;}
const model=load('src/lib/products.ts');
const whatsapp=load('src/lib/whatsapp.ts',{'./config':{storeConfig:{whatsappNumber:''}},'./products':model});
let selected=0,ident=0;
const mocks={react:{useState:()=>[selected,n=>{selected=n;}],useRef:()=>({current:null}),useEffect:()=>{},useId:()=>`test-${ident++}`},'next/image':()=>null,'next/link':()=>null,'lucide-react':{},'@/components/product-image':{ProductImage:()=>null},'@/lib/products':model,'@/lib/supabase/use-catalog-preview':{},'@/lib/supabase/use-store-settings':{},'@/lib/whatsapp':whatsapp,'./public-store.css':{},'./public-mobile.css':{},'@/components/testimonial-gallery':{}};
const context={exports:{},require:n=>n in mocks?mocks[n]:require(n)};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText+'\nexports.Card=ProductCard;',context);
function all(tree){if(!tree||typeof tree!=='object')return [];return [tree,...[tree.props?.children].flat(Infinity).flatMap(all)];}
function text(tree){if(typeof tree==='string'||typeof tree==='number')return String(tree);if(!tree||typeof tree!=='object')return '';return [tree.props?.children].flat(Infinity).map(text).join(' ');}
const product={...model.initialProducts[0],plans:[{duration:'3 bulan',price:120000},{duration:'1 bulan',price:45000}]};
const settings={number:'6281234567890',template:'{produk} | {durasi} | {harga}'};
let toggles=0;const render=(open=false,mobile=true)=>context.exports.Card({product,settings,settingsReady:true,open,mobile,onToggle:()=>toggles++});
let tree=render(),nodes=all(tree),header=nodes.find(n=>n.props?.className==='rp-compact-header'),panel=nodes.find(n=>n.type==='dialog');
assert.equal(header.type,'button');assert.equal(header.props['aria-expanded'],false);assert.ok(!text(header).includes('Mulai'));assert.equal(panel.props.inert,true);assert.equal(panel.props.id,header.props['aria-controls']);header.props.onClick();assert.equal(toggles,1);
let quick=nodes.filter(n=>n.type==='button'&&n.props.className?.startsWith('rp-quick-plan '));
// Include the inactive badge whose class has no suffix.
quick=nodes.filter(n=>n.type==='button'&&/^rp-quick-plan(?: |$)/.test(n.props.className??''));
assert.equal(quick.length,2);assert.equal(quick[0].props['aria-pressed'],true);
let quickLink=nodes.find(n=>n.type==='a'&&n.props.className==='rp-quick-order');
assert.ok(new URL(quickLink.props.href).searchParams.get('text').includes('3 bulan'));
quick[1].props.onClick();assert.equal(toggles,1);
nodes=all(render(true));assert.equal(nodes.find(n=>n.props?.className==='rp-compact-header').props['aria-expanded'],true);assert.equal(nodes.find(n=>n.type==='dialog').props.inert,false);
let radios=nodes.filter(n=>n.type==='input'&&n.props.type==='radio');assert.equal(radios.length,2);radios[1].props.onChange();
nodes=all(render(true));assert.equal(nodes.filter(n=>n.type==='input')[1].props.checked,true);
const link=nodes.find(n=>n.type==='a'&&n.props.className==='rp-order');const msg=new URL(link.props.href).searchParams.get('text');assert.ok(msg.includes('1 bulan'));assert.ok(msg.includes(model.rupiah(45000)));
quickLink=nodes.find(n=>n.type==='a'&&n.props.className==='rp-quick-order');assert.equal(quickLink.props.href,link.props.href);
assert.equal(nodes.filter(n=>n.type==='button'&&/^rp-quick-plan(?: |$)/.test(n.props.className??''))[1].props['aria-pressed'],true);
product.plans.push({duration:'1 tahun',price:500000});
nodes=all(render(true));nodes.filter(n=>n.type==='input'&&n.props.type==='radio')[2].props.onChange();
nodes=all(render(false));quick=nodes.filter(n=>n.type==='button'&&/^rp-quick-plan(?: |$)/.test(n.props.className??''));
assert.equal(quick.length,2);assert.ok(text(quick[1]).includes('1 tahun'));assert.equal(quick[1].props['aria-pressed'],true);
assert.ok(new URL(nodes.find(n=>n.type==='a'&&n.props.className==='rp-quick-order').props.href).searchParams.get('text').includes('1 tahun'));
product.plans.pop();selected=1;
assert.equal(all(render(false,false)).some(n=>n.type==='dialog'),false);
assert.ok(all(render(false,false)).some(n=>n.props?.className==='rp-details-motion'));
assert.equal(header.props['aria-haspopup'],'dialog');
assert.equal(panel.props['aria-labelledby'],panel.props.id+'-title');
let cancelled=false;panel.props.onCancel({preventDefault:()=>cancelled=true});assert.equal(cancelled,true);
assert.ok(all(render(true)).some(n=>n.type==='button'&&n.props['aria-label']==='Tutup detail produk'));
assert.equal(selected,1);
// Stock scenarios share effective selection across mobile sheet and desktop.
product.plans[0].available=false;selected=0;
nodes=all(render(true));assert.equal(nodes.filter(n=>n.type==='input')[0].props.disabled,true);assert.equal(nodes.filter(n=>n.type==='input')[1].props.checked,true);
quick=nodes.filter(n=>n.type==='button'&&/^rp-quick-plan(?: |$)/.test(n.props.className??''));assert.equal(quick[0].props.disabled,true);assert.ok(text(quick[0]).includes('Habis'));quick[0].props.onClick();assert.equal(selected,0);
assert.ok(new URL(nodes.find(n=>n.type==='a'&&n.props.className==='rp-quick-order').props.href).searchParams.get('text').includes('1 bulan'));
product.plans[1].available=false;
for(const mobile of [true,false]){nodes=all(render(true,mobile));assert.ok(!nodes.some(n=>n.type==='a'&&['rp-order','rp-quick-order'].includes(n.props.className)));assert.ok(nodes.filter(n=>n.type==='input').every(n=>n.props.disabled));assert.ok(nodes.filter(n=>n.type==='button'&&['rp-order','rp-quick-order'].includes(n.props.className)).every(n=>n.props.disabled&&text(n).includes('Stok Habis')));}
assert.equal(whatsapp.whatsAppLink(settings,product,product.plans[0]),'');
product.plans.forEach(p=>delete p.available);selected=1;
// Render Home's controlled card props to exercise one-open-at-a-time ownership.
const homeState=[];let hook=0;
mocks.react.useState=initial=>{const i=hook++;if(!(i in homeState))homeState[i]=initial;return [homeState[i],next=>{homeState[i]=typeof next==='function'?next(homeState[i]):next;}];};
mocks['@/lib/supabase/use-catalog-preview'].useCatalogPreview=()=>({state:{status:'ready',products:model.initialProducts,error:null}});
mocks['@/lib/supabase/use-store-settings'].useStoreSettings=()=>({settings,ready:true,error:''});
function homeCards(){hook=0;return all(context.exports.default()).filter(n=>n.type===context.exports.Card);}
let cards=homeCards();assert.ok(cards.every(c=>!c.props.open));cards[0].props.onToggle();cards=homeCards();assert.equal(cards.filter(c=>c.props.open).length,1);assert.equal(cards[0].props.open,true);
cards[1].props.onToggle();cards=homeCards();assert.equal(cards.filter(c=>c.props.open).length,1);assert.equal(cards[1].props.open,true);cards[1].props.onToggle();assert.ok(homeCards().every(c=>!c.props.open));
console.log('PASS: square tile/dialog closed-by-default semantics, two dynamic badges, first-plan default, badge/sheet selection synchronized, toggle callback, dialog ID/inert/cancel/close, package state retained and WhatsApp reflects selection, desktop content enabled. Mock render only.');
