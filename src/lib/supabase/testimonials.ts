import type { SupabaseClient } from '@supabase/supabase-js';
export const TESTIMONIAL_BUCKET='testimonials';
export const MAX_TESTIMONIAL_BYTES=5*1024*1024;
export type Testimonial={id:string;image_url:string;storage_path:string;sort_order:number;created_at:string;is_published:boolean;url:string};
export async function readTestimonials(client:SupabaseClient,admin=false):Promise<Testimonial[]>{
 let query=client.from('testimonials').select('id,image_url,storage_path,sort_order,created_at,is_published').order('sort_order').order('created_at').order('id');
 if(!admin)query=query.eq('is_published',true);
 const {data,error}=await query;if(error)throw Error('Testimoni belum dapat dibaca. Pastikan migrasi dan Storage sudah dikonfigurasi.');
 if(!data?.length)return [];
 const signed=await client.storage.from(TESTIMONIAL_BUCKET).createSignedUrls(data.map(r=>r.storage_path),300);
 if(signed.error)throw Error('Preview Storage belum tersedia. Periksa konfigurasi bucket.');
 return data.map((r,i)=>{
  const result=signed.data?.[i];
  if(!result?.signedUrl || result.error){
   // Keep a partially deleted row manageable so Admin can retry its cleanup.
   if(admin)return {...r,url:''};
   throw Error('Salah satu screenshot tidak tersedia atau akses Storage ditolak.');
  }
  return {...r,url:result.signedUrl};
 });
}
export async function validateTestimonialFile(file:File){
 const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 const ext=extensions[file.type];if(!ext||file.size===0||file.size>MAX_TESTIMONIAL_BYTES)throw Error('Gunakan JPG, PNG, atau WebP maksimal 5 MB.');
 const b=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const valid=ext==='jpg'?b[0]===255&&b[1]===216&&b[2]===255:ext==='png'?[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n):String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
 if(!valid)throw Error('Isi file tidak sesuai format gambar.');return ext;
}
