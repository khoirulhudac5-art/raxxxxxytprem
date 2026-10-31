// Mock/render/handler checks only. No cookies, storage or live Auth modifications.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const React=require('react');
function load(file,imports){const ctx={exports:{},URL,crypto:require('node:crypto').webcrypto,require:name=>name in imports?imports[name]:require(name)};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,ctx);return ctx.exports;}
const products=JSON.parse(fs.readFileSync('rakyat-premium-backup-2026-10-30T09-05-23-204Z.json','utf8')).products;
const model=load('src/lib/products.ts',{});
function nodes(value){if(Array.isArray(value))return value.flatMap(nodes);if(!value||typeof value!=='object')return[];return [value,...nodes(value.props?.children)];}
function workspace(preview,status='ready',forcedDraft=null,forcedDelete=null,crud=false,mutationOK=true){
 const effects={writes:0,drafts:0,deletes:0,retries:0,reader:null,mutations:[]};let stateIndex=0;
 const Component=load('src/components/admin-workspace.tsx',{
  react:{...React,useCallback:fn=>fn,useState:initial=>{const index=stateIndex++;return [[forcedDraft,forcedDelete,''][index]??initial,next=>{if(index===0){effects.drafts++;effects.draftValue=typeof next==='function'?next(forcedDraft):next;}if(index===1)effects.deletes++;}];}},
  '@/components/product-image-upload':{ProductImageUpload:()=>null},'@/components/shared-whatsapp-settings':{SharedWhatsAppSettings:()=>null},
  '@/components/dialog-keyboard':{DialogKeyboard:()=>null},'@/components/header':{Header:()=>null},
  '@/components/product-image':{ProductImage:()=>null},'@/components/whatsapp-settings':{WhatsAppSettingsPanel:()=>null},'@/components/export-backup':{ExportBackup:()=>null},
  '@/lib/products':model,'@/lib/use-products':{useProducts:()=>({products,ready:true,error:'',save:()=>{effects.writes++;return true;}})},
  '@/lib/supabase/catalog':{migratedCatalogOrder:products.map(p=>p.id)},
  '@/lib/supabase/use-product-crud':{useProductCrud:()=>({products:products.map((p,i)=>({...p,revision:1,sortOrder:(i+1)*10})),ready:true,error:'',busy:false,refresh:()=>{},mutate:async value=>{effects.mutations.push(value);return mutationOK;}})},
  '@/lib/supabase/use-catalog-preview':{useCatalogPreview:(enabled,order)=>{effects.reader={enabled,order};return {state:{status,products:status==='ready'?products:[],error:status==='error'?'Supabase gagal':null},retry:()=>effects.retries++};}},
 }).default;
 return {tree:Component({supabasePreview:preview,supabaseCrud:crud}),effects};
}
async function run(){
 const preview=workspace(true),list=nodes(preview.tree);
 assert.equal(preview.effects.reader.enabled,true);
 assert.equal(preview.effects.reader.order,undefined,'Both previews must use the shared default order, not device-local order');
 assert.equal(list.filter(n=>n.type==='article'&&n.props.className==='admin-row').length,7);
 assert.equal(products.reduce((sum,p)=>sum+p.plans.length,0),14);
 const controls=list.filter(n=>n.type==='button'&&(n.props['aria-label']?.match(/^(Edit|Hapus) /)||n.props.className==='primary-button'));
 assert.equal(controls.length,15);
 for(const control of controls){assert.equal(control.props.disabled,true);control.props.onClick();}
 assert.equal(preview.effects.writes,0);assert.equal(preview.effects.drafts,0);assert.equal(preview.effects.deletes,0);
 const forced=workspace(true,'ready',products[0],products[0]);
 assert.equal(nodes(forced.tree).filter(n=>n.props?.role==='dialog'||n.props?.role==='alertdialog').length,0);
 for(const status of ['loading','idle','error','empty']){
  const current=workspace(true,status),els=nodes(current.tree);assert.equal(els.filter(n=>n.type==='article').length,0);
  if(['error','empty'].includes(status)){const retry=els.find(n=>n.type==='button'&&n.props.children==='Coba lagi');assert.ok(retry);retry.props.onClick();assert.equal(current.effects.retries,1);}
 }
 const normal=workspace(false);assert.equal(normal.effects.reader.enabled,false);
 const edit=nodes(normal.tree).find(n=>n.props?.['aria-label']==='Edit ChatGPT Plus');assert.equal(edit.props.disabled,false);edit.props.onClick();assert.equal(normal.effects.drafts,1);
 const draft=workspace(false,'ready',products[0]);const form=nodes(draft.tree).find(n=>n.type==='form'&&n.props.onSubmit);form.props.onSubmit({preventDefault(){}});assert.equal(draft.effects.writes,1);
 const deletion=workspace(false,'ready',null,products[0]);nodes(deletion.tree).find(n=>n.type==='button'&&n.props.className==='primary-button delete-button').props.onClick();assert.equal(deletion.effects.writes,1);
 const remoteDraft={...products[0],revision:3,sortOrder:10};
 const remoteEdit=workspace(false,'ready',remoteDraft,null,true);
 await nodes(remoteEdit.tree).find(n=>n.type==='form'&&n.props.onSubmit).props.onSubmit({preventDefault(){}});
 assert.equal(remoteEdit.effects.writes,0);assert.equal(remoteEdit.effects.mutations[0].operation,'update');assert.equal(remoteEdit.effects.mutations[0].revision,3);assert.ok(remoteEdit.effects.mutations[0].product.plans.every(p=>p.available===true));
 const stockToggle=workspace(false,'ready',remoteDraft,null,true);
 const stockSelect=nodes(stockToggle.tree).find(n=>n.type==='select'&&n.props['aria-label']==='Status stok paket 1');
 assert.equal(stockSelect.props.value,'available');stockSelect.props.onChange({target:{value:'empty'}});
 assert.equal(stockToggle.effects.draftValue.plans[0].available,false);
 const toggledEditor=workspace(false,'ready',stockToggle.effects.draftValue,null,true);
 await nodes(toggledEditor.tree).find(n=>n.type==='form'&&n.props.onSubmit).props.onSubmit({preventDefault(){}});
 assert.equal(toggledEditor.effects.mutations[0].product.plans[0].available,false);
 const stockDraft={...remoteDraft,plans:remoteDraft.plans.map((p,i)=>({...p,available:i!==0}))};
 const stockEditor=workspace(false,'ready',stockDraft,null,true);
 await nodes(stockEditor.tree).find(n=>n.type==='form'&&n.props.onSubmit).props.onSubmit({preventDefault(){}});
 assert.equal(stockEditor.effects.mutations[0].product.plans[0].available,false);
 assert.equal(nodes(stockEditor.tree).filter(n=>n.type==='select'&&n.props['aria-label']?.startsWith('Status stok')).length,2);
 const failedEdit=workspace(false,'ready',remoteDraft,null,true,false);
 await nodes(failedEdit.tree).find(n=>n.type==='form'&&n.props.onSubmit).props.onSubmit({preventDefault(){}});
 assert.equal(failedEdit.effects.drafts,0,'Failed mutation must preserve draft');assert.equal(failedEdit.effects.writes,0);
 const remoteDelete=workspace(false,'ready',null,remoteDraft,true);
 await nodes(remoteDelete.tree).find(n=>n.type==='button'&&n.props.className==='primary-button delete-button').props.onClick();
 assert.equal(remoteDelete.effects.writes,0);assert.equal(remoteDelete.effects.mutations[0].revision,3);
 for(const access of ['unauthenticated','denied','unavailable','admin']){
  const Workspace=()=>null,Message=()=>null;
  const page=load('src/app/admin/page.tsx',{'@/lib/supabase/crud-flag':{productCrudEnabled:()=>false},'next/navigation':{redirect:()=>{throw Error('REDIRECT');}},'@/components/admin-workspace':{default:Workspace,__esModule:true},'@/components/admin-access-message':{AdminAccessMessage:Message},'@/lib/supabase/server':{createClient:async()=>({})},'@/lib/supabase/admin-access':{checkAdminAccess:async() =>access}}).default;
  if(access==='unauthenticated'){await assert.rejects(()=>page({searchParams:Promise.resolve({source:'supabase-preview'})}),/REDIRECT/);continue;}
  const tree=await page({searchParams:Promise.resolve({source:'supabase-preview'})});
  if(access==='admin')assert.equal(nodes(tree).find(n=>n.type===Workspace).props.supabasePreview,true);
  else {assert.equal(tree.type,Message);assert.ok(!nodes(tree).some(n=>n.type===Workspace));}
 }
 console.log('PASS: 7 preview rows/14 plans, reference order, all 15 controls disabled AND forced click handlers blocked; modals blocked; error/empty/retry; normal edit/save/delete work; server denies anonymous/non-Admin/unavailable preview. Mock only.');
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
