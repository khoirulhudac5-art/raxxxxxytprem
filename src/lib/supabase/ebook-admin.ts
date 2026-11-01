import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {validEbookPath,validFreeDownload,type EbookAdminData} from '../ebooks';
import {EbookError} from './ebook-error';
import {verifyStoredEbookImage} from './ebook-image.server';
export {EbookError} from './ebook-error';
const columns={ebook:'id,slug,title,description,category_id,cover_path,is_free,price,free_download_url,is_published,sort_order,revision',category:'id,slug,name,is_active,sort_order,revision',settings:'id,banner_path,banner_alt,banner_enabled,revision'};
const tables={ebook:'ebooks',category:'ebook_categories',settings:'ebook_settings'};
type Entity=keyof typeof tables;
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw new EbookError(400,'Format permintaan tidak valid.');return v as Record<string,unknown>;}
function int(v:unknown,min=0,max=2147483647):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw new EbookError(400,'Angka, urutan, atau revisi tidak valid.');return v;}
function bool(v:unknown):boolean{if(typeof v!=='boolean')throw new EbookError(400,'Status harus boolean.');return v;}
function text(p:Record<string,unknown>,k:string,max:number,required=false){const v=p[k];if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new EbookError(400,`Kolom ${k} tidak valid.`);return v.trim();}
function path(p:Record<string,unknown>,key:string,kind:'covers'|'banners'){if(p[key]===null||p[key]==='')return null;const v=text(p,key,200,true);if(!validEbookPath(v,kind))throw new EbookError(400,'Referensi gambar tidak valid.');return v;}
function slug(p:Record<string,unknown>,max:number){const v=text(p,'slug',max,true);if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v))throw new EbookError(400,'Slug hanya huruf kecil, angka, dan tanda hubung.');return v;}
export function validateEbookRequest(input:unknown){
 const v=object(input);
 if(v.operation==='list')return {operation:'list' as const};
 if(!['create','update','delete'].includes(String(v.operation))||!Object.hasOwn(tables,String(v.entity)))throw new EbookError(400,'Operasi tidak valid.');
 const entity=v.entity as Entity,operation=v.operation as 'create'|'update'|'delete';
 const id=v.id;if(typeof id!=='string'||(entity==='settings'?id!=='main':!uuid.test(id)))throw new EbookError(400,'ID tidak valid.');
 if(entity==='settings'&&operation!=='update')throw new EbookError(400,'Konfigurasi banner hanya dapat diedit.');
 const revision=operation==='create'?undefined:int(v.revision,1);
 if(operation==='delete')return {operation,entity,id,revision,data:undefined};
 const p=object(v.data);let data:Record<string,unknown>;
 if(entity==='ebook'){
  const is_free=bool(p.is_free),price=int(p.price,0,999999999999),is_published=bool(p.is_published);
  if((is_free&&price!==0)||(!is_free&&price<1))throw new EbookError(400,'Harga gratis harus nol; harga berbayar harus positif.');
  // Never accept a paid download, including hidden/stale fields in a client payload.
  const download=p.free_download_url===null||p.free_download_url===''?null:text(p,'free_download_url',2048,true);
  if(!is_free&&download!==null)throw new EbookError(400,'E-book berbayar tidak boleh memiliki URL download.');
  if(download&&!validFreeDownload(download))throw new EbookError(400,'Gunakan URL download HTTPS yang valid tanpa kredensial.');
  const cover_path=path(p,'cover_path','covers');
  if(is_published&&(!cover_path||(is_free&&!download)))throw new EbookError(400,'Publikasi memerlukan cover dan link download untuk e-book gratis.');
  const category_id=text(p,'category_id',36,true);if(!uuid.test(category_id))throw new EbookError(400,'Kategori tidak valid.');
  data={slug:slug(p,160),title:text(p,'title',200,true),description:text(p,'description',12000),category_id,cover_path,is_free,price,free_download_url:download,is_published,sort_order:int(p.sort_order)};
 }else if(entity==='category'){
  data={slug:slug(p,120),name:text(p,'name',120,true),is_active:bool(p.is_active),sort_order:int(p.sort_order)};
 }else{
  const banner_path=path(p,'banner_path','banners'),banner_alt=text(p,'banner_alt',200),banner_enabled=bool(p.banner_enabled);
  if(banner_enabled&&(!banner_path||!banner_alt))throw new EbookError(400,'Banner aktif memerlukan gambar dan teks alternatif.');
  data={banner_path,banner_alt,banner_enabled};
 }
 return {operation,entity,id,revision,data};
}
function databaseError(error:{code?:string}):never{
 if(error.code==='23505')throw new EbookError(409,'Slug atau ID sudah digunakan. Muat ulang sebelum mencoba lagi.');
 if(error.code==='23503'||error.code==='23001')throw new EbookError(409,'Kategori masih digunakan atau kategori tujuan tidak tersedia.');
 if(error.code==='23514'||error.code==='P0001')throw new EbookError(400,'Data ditolak. Slug tidak dapat diubah setelah dibuat; periksa harga, gambar, dan publikasi.');
 if(error.code==='42501')throw new EbookError(403,'Akses ditolak oleh kebijakan Admin.');
 throw new EbookError(503,'Layanan e-book belum tersedia. Muat ulang untuk memeriksa hasil sebelum mengulangi simpan.');
}
export async function executeEbookAdmin(client:SupabaseClient,input:unknown){
 const v=validateEbookRequest(input);
 if(v.operation==='list'){
  const results=await Promise.all([
   client.from(tables.ebook).select(columns.ebook).order('sort_order').order('id'),
   client.from(tables.category).select(columns.category).order('sort_order').order('id'),
   client.from(tables.settings).select(columns.settings).eq('id','main').single()
  ]);
  for(const r of results)if(r.error)databaseError(r.error);
  const data={ebooks:results[0].data,categories:results[1].data,settings:results[2].data} as unknown as EbookAdminData;
  // Fail closed if a DB contract ever drifts; never serialize a paid download URL.
  if(!data.settings||data.ebooks.some(e=>!e.is_free&&e.free_download_url!==null))throw new EbookError(503,'Struktur data e-book tidak sesuai konfigurasi.');
  return data;
 }
 const table=()=>client.from(tables[v.entity]);
 // Validate again on Save so clients cannot attach an arbitrary/unverified path.
 // Null only detaches; stale revisions and shared references never delete files.
 if(v.operation!=='delete'){
  const image=v.entity==='ebook'?v.data?.cover_path:v.entity==='settings'?v.data?.banner_path:null;
  if(typeof image==='string')await verifyStoredEbookImage(client,image,v.entity==='ebook'?'covers':'banners');
 }
 if(v.operation==='create'){
  const r=await table().insert({...v.data,id:v.id}).select('id,revision').single();
  if(r.error)databaseError(r.error);return {saved:r.data};
 }
 // Both UPDATE and DELETE use atomic revision predicates; never read-then-unconditional-write.
 const query=v.operation==='update'?table().update(v.data):table().delete();
 const r=await query.eq('id',v.id).eq('revision',v.revision!).select('id,revision');
 if(r.error)databaseError(r.error);
 if(!r.data||r.data.length!==1)throw new EbookError(409,'Data sudah berubah atau dihapus. Muat ulang daftar; draft Anda tetap tersedia.');
 // Images are deliberately retained: no Storage.remove or overwrite, including shared files.
 return {saved:r.data[0]};
}
