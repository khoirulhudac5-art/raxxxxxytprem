import type {SupabaseClient} from '@supabase/supabase-js';
import {EBOOK_BUCKET,validEbookPath} from './ebooks';
import {validateTestimonialFile} from './supabase/testimonials';
type Kind='covers'|'banners';
export type PendingEbookUpload={path:string;kind:Kind;createdAt:string};
const journalKey='rakyat-ebook-pending-uploads-v1';
// Recovery notes only; catalog data remains exclusively in Supabase.
export function pendingEbookUploads():PendingEbookUpload[]{
 try{const rows=JSON.parse(window.localStorage.getItem(journalKey)||'[]');return Array.isArray(rows)?rows.filter(r=>r&&['covers','banners'].includes(r.kind)&&typeof r.path==='string'&&validEbookPath(r.path,r.kind)&&typeof r.createdAt==='string').map(r=>({path:r.path,kind:r.kind,createdAt:r.createdAt})):[];}catch{return [];}
}
function remember(path:string,kind:Kind){try{const rows=pendingEbookUploads();if(!rows.some(r=>r.path===path))window.localStorage.setItem(journalKey,JSON.stringify([...rows,{path,kind,createdAt:new Date().toISOString()}]));}catch{/* Storage remains untouched if local recovery notes are unavailable. */}}
export function forgetEbookUpload(path:string|null){if(!path)return;try{window.localStorage.setItem(journalKey,JSON.stringify(pendingEbookUploads().filter(r=>r.path!==path)));}catch{/* Never delete a Storage object to clean local notes. */}}
export async function confirmEbookUpload(path:string,kind:Kind){
 if(!['covers','banners'].includes(kind)||!validEbookPath(path,kind))throw Error('Referensi gambar tidak valid.');
 const response=await fetch('/admin/api/ebooks/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,kind})});
 let data;try{data=await response.json();}catch{throw Error('Verifikasi belum pasti. File tidak dihapus; coba lagi.');}
 if(!response.ok||!data||data.path!==path)throw Error(typeof data?.error==='string'?data.error:'Verifikasi gambar gagal.');
 return path;
}
export async function uploadEbookDirect(client:SupabaseClient,file:File,kind:Kind,retryPath:string|null,onPath:(path:string)=>void){
 if(!['covers','banners'].includes(kind))throw Error('Jenis gambar tidak valid.');
 const ext=await validateTestimonialFile(file);
 const auth=await client.auth.getUser();if(auth.error||!auth.data.user)throw Error('Sesi berakhir. Login kembali sebelum upload.');
 const admin=await client.rpc('is_admin');if(admin.error||admin.data!==true)throw Error('Akses Admin diperlukan.');
 const path=retryPath??`${kind}/${crypto.randomUUID()}.${ext}`;
 if(!validEbookPath(path,kind)||!path.endsWith('.'+ext))throw Error('Path retry tidak sesuai gambar pilihan. Pilih ulang gambar.');
 remember(path,kind);onPath(path);
 // Browser -> Supabase directly, under existing RLS and bucket MIME/size limits.
 // A retry uses the SAME UUID; upsert:false preserves a previously stored object.
 try{await client.storage.from(EBOOK_BUCKET).upload(path,file,{contentType:file.type,upsert:false});}catch{/* Transport errors may still have committed. Verify the stable path below. */}
 // Verify even after a returned error (including duplicate from an uncertain retry).
 try{return await confirmEbookUpload(path,kind);}catch(e){throw Error(`${e instanceof Error?e.message:'Verifikasi gagal.'} File tetap disimpan jika upload sudah diterima. Path pemulihan: ${path}`);}
}
