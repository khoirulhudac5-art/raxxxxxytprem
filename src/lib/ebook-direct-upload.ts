import type {SupabaseClient} from '@supabase/supabase-js';
import {EBOOK_BUCKET,validEbookPath} from './ebooks';
import {validateTestimonialFile} from './supabase/testimonials';
type Kind='covers'|'banners';
// Keep provider diagnostics useful without displaying raw responses or credentials.
function storageFailure(error:unknown){
 const e=error&&typeof error==='object'?error as {statusCode?:unknown;status?:unknown;code?:unknown;message?:unknown}:{};
 const status=String(e.statusCode??e.status??''),code=typeof e.code==='string'&&/^[a-zA-Z0-9_]{1,64}$/.test(e.code)?e.code:'';
 const detail=[/^\d{3}$/.test(status)?'HTTP '+status:'',code].filter(Boolean).join(', ');
 const message=typeof e.message==='string'?e.message:'';
 const reason=status==='403'||code==='42501'||/row.level security|unauthorized/i.test(message)?'Akses upload ditolak; periksa sesi Admin dan kebijakan Storage.'
  :code==='NoSuchBucket'||/bucket not found/i.test(message)?'Bucket ebook-images belum tersedia; konfigurasi perlu diperiksa.'
  :status==='413'||code==='EntityTooLarge'?'Storage menolak ukuran gambar.'
  :status==='415'||code==='InvalidMimeType'?'Storage menolak format gambar.'
  :'Periksa koneksi dan konfigurasi Storage sebelum mencoba lagi.';
 return 'Upload Storage gagal'+(detail?' ('+detail+')':'')+'. '+reason;
}
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
 let uploadError:unknown;
 try{const result=await client.storage.from(EBOOK_BUCKET).upload(path,file,{contentType:file.type,upsert:false});uploadError=result.error;}catch(e){uploadError=e;/* Transport errors may still have committed. Verify the stable path below. */}
 // Verify even after a returned error (including duplicate from an uncertain retry).
 try{return await confirmEbookUpload(path,kind);}catch(e){throw Error(`${uploadError?storageFailure(uploadError)+' ':''}${e instanceof Error?e.message:'Verifikasi gagal.'} File tetap disimpan jika upload sudah diterima. Path pemulihan: ${path}`);}
}
