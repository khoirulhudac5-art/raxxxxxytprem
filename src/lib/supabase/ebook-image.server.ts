import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {EBOOK_BUCKET,EBOOK_IMAGE_LIMIT,validEbookPath} from '../ebooks';
import {validateTestimonialFile} from './testimonials';
import {EbookError} from './ebook-error';
// Called only after the server's Admin check, using its session and existing RLS.
// HTTP requests/responses carry metadata only. This outbound Storage read is not
// a browser upload through Vercel. No service-role access and no automatic deletion.
export async function verifyStoredEbookImage(client:SupabaseClient,path:string,kind:'covers'|'banners'){
 if(!validEbookPath(path,kind))throw new EbookError(400,'Referensi gambar tidak valid.');
 let result;
 try{result=await client.storage.from(EBOOK_BUCKET).download(path);}catch{throw new EbookError(503,'Verifikasi Storage gagal. File tetap disimpan; coba verifikasi ulang.');}
 if(result.error||!result.data)throw new EbookError(503,'File belum dapat diverifikasi di Storage. Coba ulang; file tidak dihapus.');
 const blob=result.data,type=blob.type.split(';')[0].toLowerCase();
 if(!blob.size||blob.size>EBOOK_IMAGE_LIMIT)throw new EbookError(400,'Ukuran gambar harus lebih dari nol dan maksimal 5 MB.');
 try{
  const ext=await validateTestimonialFile(new File([blob],path,{type}));
  const actual=path.split('.').pop();if(actual!==ext&&!(ext==='jpg'&&actual==='jpeg'))throw Error('extension mismatch');
 }catch{throw new EbookError(400,'File Storage harus PNG, JPG, atau WebP dengan isi dan ekstensi yang sesuai.');}
 return {path};
}
