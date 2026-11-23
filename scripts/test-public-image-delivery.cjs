// Offline only: verify delivery attributes and exact visible/alpha equivalence, no API calls.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),React=require('react'),sharp=require('sharp'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,imports={}){const ctx={exports:{},URL,require:n=>n in imports?imports[n]:require(n)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.exports;}
const products=load('src/lib/products.ts'),images=load('src/components/product-image.tsx',{'@/lib/products':products});
const product={...products.initialProducts[0],imageUrl:'https://example.invalid/product.png'}; // In-memory render input only.
function render(loading){return renderToStaticMarkup(React.createElement(images.ProductImage,{product,loading}));}
assert(!render().includes('loading='),'Existing Admin/default loading must stay unchanged');
const lazy=render('lazy');assert(lazy.includes('loading="lazy"'));assert(lazy.includes('decoding="async"'));assert(!lazy.includes('rel="preload"'));
const eager=render('eager');assert(eager.includes('loading="eager"'));assert(eager.includes('decoding="async"'));
assert(fs.readFileSync('src/app/page.tsx','utf8').includes('<ProductImage product={product} loading="lazy"/>'));
assert(fs.readFileSync('src/components/product-detail.tsx','utf8').includes('<ProductImage product={product} loading="eager"/>'));
assert(fs.readFileSync('src/components/ebook-cover.tsx','utf8').includes('loading="lazy" decoding="async" fetchPriority="low"'));
assert(fs.readFileSync('src/components/testimonial-gallery.tsx','utf8').includes('loading="lazy" decoding="async"'));
(async()=>{for(const stem of ['katalog-apps-transparan','katalog-ebook-transparan','logo-rakyatpremium','text-rakyatpremium']){const orig='public/artwork/'+stem+'.png.png',delivery='public/artwork/'+stem+'.lossless.webp';assert(fs.statSync(delivery).size<fs.statSync(orig).size);const a=await sharp(orig).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(delivery).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual(a.info,b.info);for(let i=0;i<a.data.length;i+=4){assert.equal(a.data[i+3],b.data[i+3]);if(a.data[i+3]){assert.equal(a.data[i],b.data[i]);assert.equal(a.data[i+1],b.data[i+1]);assert.equal(a.data[i+2],b.data[i+2]);}}}console.log('PASS: four lossless delivery copies preserve dimensions, every visible RGB pixel and all alpha; public lazy/async delivery, eager detail and unchanged Admin/default behavior. Offline only.');})().catch(e=>{console.error(e);process.exitCode=1;});
