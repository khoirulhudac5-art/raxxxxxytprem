// Local boundary tests only: no production requests or writes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const context={exports:{},Uint8Array,String,Error};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/supabase/testimonials.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const {validateTestimonialFile,readTestimonials}=context.exports;
async function main(){
 const valid=[['image/png',[137,80,78,71,13,10,26,10],'png'],['image/jpeg',[255,216,255,0],'jpg'],['image/webp',[82,73,70,70,0,0,0,0,87,69,66,80],'webp']];
 for(const [type,bytes,ext] of valid)assert.equal(await validateTestimonialFile(new File([new Uint8Array(bytes)],'test',{type})),ext);
 await assert.rejects(()=>validateTestimonialFile(new File(['not png'],'x',{type:'image/png'})));
 await assert.rejects(()=>validateTestimonialFile(new File(['x'],'x',{type:'image/svg+xml'})));
 await assert.rejects(()=>validateTestimonialFile(new File([new Uint8Array(5*1024*1024+1)],'x',{type:'image/png'})));
 let filter=false,signed=false;
 function client(rows,error=null){const q={select(){return q;},order(){return q;},eq(k,v){assert.equal(k,'is_published');assert.equal(v,true);filter=true;return q;},then(resolve){resolve({data:rows,error});}};return {from(name){assert.equal(name,'testimonials');return q;},storage:{from(name){assert.equal(name,'testimonials');return {async createSignedUrls(paths,ttl){assert.equal(ttl,300);assert.equal(paths[0],'test.png');signed=true;return {data:[{signedUrl:'https://example.invalid/signed'}]};}};}}};}
 assert.equal((await readTestimonials(client([]))).length,0);assert.equal(filter,true);assert.equal(signed,false);
 const rows=await readTestimonials(client([{id:'1',storage_path:'test.png'}]));assert.equal(rows[0].url,'https://example.invalid/signed');assert.equal(signed,true);
 filter=false;await readTestimonials(client([]),true);assert.equal(filter,false);
 await assert.rejects(()=>readTestimonials(client(null,{code:'42P01'})));
 const denied=client([{id:'1',storage_path:'test.png'}]);
 denied.storage.from=()=>({createSignedUrls:async()=>({data:[{signedUrl:null,error:'Access denied'}]})});
 await assert.rejects(()=>readTestimonials(denied),/akses Storage ditolak/);
 assert.equal((await readTestimonials(denied,true))[0].url,'');
 console.log('PASS: file signature/type/5MB validation, published-only query, signed URLs, empty/error states, Admin listing. Mock only.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});



