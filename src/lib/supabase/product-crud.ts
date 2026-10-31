import type { SupabaseClient } from '@supabase/supabase-js';
import { mapSupabaseProducts, PRODUCT_COLUMNS } from './products';
import { validImageUrl, type Product } from '../products';
export type CrudProduct = Product & {revision:number;sortOrder:number};
export class CrudError extends Error {
 constructor(public status:number,message:string){super(message);}
}
const columns=PRODUCT_COLUMNS+',revision,sort_order';
const integer=(v:unknown,min=0):v is number=>typeof v==='number' && Number.isSafeInteger(v) && v>=min && v<=2147483647;
function object(v:unknown):Record<string,unknown>{
 if(!v || typeof v!=='object' || Array.isArray(v))throw new CrudError(400,'Format permintaan tidak valid.');
 return v as Record<string,unknown>;
}
export function mapCrudProducts(value:unknown):CrudProduct[]{
 const mapped=mapSupabaseProducts(value);
 return mapped.map((p,i)=>{
  const row=(value as Record<string,unknown>[])[i];
  if(!integer(row.revision,1)||!integer(row.sort_order))throw new CrudError(503,'Schema CRUD belum siap.');
  return {...p,revision:row.revision,sortOrder:row.sort_order};
 });
}
export function validateCrudRequest(value:unknown){
 const v=object(value);
 if(v.operation==='list')return {operation:'list' as const};
 if(!['create','update','delete'].includes(String(v.operation)))throw new CrudError(400,'Operasi tidak valid.');
 const operation=v.operation as 'create'|'update'|'delete';
 if(typeof v.id!=='string'||!v.id.trim()||v.id.length>100||!/^[-a-zA-Z0-9_]+$/.test(v.id))throw new CrudError(400,'ID tidak valid.');
 if(operation==='create'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id))throw new CrudError(400,'ID produk baru harus UUID.');
 if(operation!=='create'&&!integer(v.revision,1))throw new CrudError(400,'Revisi tidak valid.');
 if(operation==='delete')return {operation,id:v.id,revision:v.revision as number};
 const p=object(v.product);
 const text=(key:string,max:number,required=false)=>{
  const val=p[key];if(typeof val!=='string'||val.length>max||(required&&!val.trim()))throw new CrudError(400,`Kolom ${key} tidak valid.`);
  return val.trim();
 };
 const name=text('name',80,true),description=text('description',240,true),category=text('category',80,true);
 const icon=text('icon',20,true),color=text('color',20,true),badge=text('badge',20),image_url=text('imageUrl',2048);
 if(!['spark','video','design','gem','play','music','camera'].includes(icon)||!['blue','green','white','cyan','red','lime'].includes(color))throw new CrudError(400,'Ikon/warna tidak valid.');
 if(image_url&&!validImageUrl(image_url))throw new CrudError(400,'URL gambar tidak valid.');
 if(!Array.isArray(p.plans)||!p.plans.length||p.plans.length>50)throw new CrudError(400,'Paket tidak valid.');
 const plans=p.plans.map(item=>{const plan=object(item);
  if((v.operation==='update'&&typeof plan.available!=='boolean')||(plan.available!==undefined&&typeof plan.available!=='boolean'))throw new CrudError(400,'Status stok setiap paket harus boolean. Muat ulang Admin sebelum menyimpan.');
  if(typeof plan.duration!=='string'||!plan.duration.trim()||plan.duration.length>40||
   typeof plan.price!=='number'||!Number.isSafeInteger(plan.price)||plan.price<0||plan.price>999999999999)throw new CrudError(400,'Durasi/harga tidak valid.');
  return {duration:plan.duration.trim(),price:plan.price,available:plan.available===undefined?true:plan.available};
 });
 return {operation,id:v.id,revision:v.revision as number|undefined,data:{name,description,category,icon,color,badge,image_url,plans}};
}
export async function executeProductCrud(client:SupabaseClient,value:unknown){
 const v=validateCrudRequest(value);
 const table=()=>client.schema('public').from('products');
 // Read schema/metadata BEFORE any write; an unmigrated database fails closed.
 const current=await table().select(columns).order('sort_order').order('id');
 if(current.error)throw new CrudError(503,'Schema CRUD belum siap atau pembacaan gagal.');
 const products=mapCrudProducts(current.data);
 if(v.operation==='list')return {products};
 if(v.operation==='create'){
  if(products.some(p=>p.id===v.id))throw new CrudError(409,'ID sudah tersedia. Muat ulang dan periksa sebelum mencoba lagi.');
  const sortOrder=Math.max(0,...products.map(p=>p.sortOrder))+10;
  if(!integer(sortOrder))throw new CrudError(409,'Posisi produk melebihi batas.');
  const result=await table().insert({id:v.id,...v.data,sort_order:sortOrder}).select(columns).single();
  if(result.error)throw new CrudError(result.error.code==='23505'?409:503,'Penyimpanan belum dikonfirmasi. Muat ulang sebelum mencoba lagi.');
  return {product:mapCrudProducts([result.data])[0]};
 }
 const query=v.operation==='update'?table().update(v.data):table().delete();
 const result=await query.eq('id',v.id).eq('revision',v.revision).select(columns);
 if(result.error)throw new CrudError(503,'Perubahan belum dikonfirmasi. Muat ulang sebelum mencoba lagi.');
 if(!result.data?.length)throw new CrudError(409,'Produk sudah berubah, dihapus, atau akses ditolak. Draft dipertahankan; muat ulang sebelum mengedit lagi.');
 const product=mapCrudProducts(result.data)[0];
 if(v.operation==='update' && product.revision!==v.revision!+1)throw new CrudError(503,'Revisi hasil tidak sesuai. Muat ulang; jangan mengulang otomatis.');
 return {product};
}
