'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {validateTestimonialFile} from '@/lib/supabase/testimonials';
import {EBOOK_BUCKET} from '@/lib/ebooks';
import {uploadEbookDirect,confirmEbookUpload,pendingEbookUploads,type PendingEbookUpload} from '@/lib/ebook-direct-upload';
export function EbookImageUpload({kind,value,onChange,onBusy,onPending,disabled}:{kind:'covers'|'banners';value:string|null;onChange:(path:string|null)=>void;onBusy:(value:boolean)=>void;onPending:(value:boolean)=>void;disabled:boolean}){
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const input=useRef<HTMLInputElement>(null),lock=useRef(false),selection=useRef(0);
 const retryPath=useRef<string|null>(null);
 const [recovery,setRecovery]=useState<PendingEbookUpload[]>([]);
 useEffect(()=>{setRecovery(pendingEbookUploads());},[]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>()=>{selection.current++;onPending(false);},[onPending]);
 const saved=value?createClient().storage.from(EBOOK_BUCKET).getPublicUrl(value).data.publicUrl:'';
 async function upload(){if(!file||lock.current)return;lock.current=true;setBusy(true);onBusy(true);setMessage('');try{
  const path=await uploadEbookDirect(createClient(),file,kind,retryPath.current,path=>{retryPath.current=path;});
  onChange(path);retryPath.current=null;setFile(null);onPending(false);if(input.current)input.current.value='';
  setMessage('Upload berhasil. Simpan formulir untuk menerapkan gambar. File lama tetap disimpan.');
 }catch(e){setMessage(e instanceof Error?e.message:'Upload gagal.');}finally{setRecovery(pendingEbookUploads());lock.current=false;setBusy(false);onBusy(false);}}
 async function recover(path:string){if(lock.current)return;selection.current++;lock.current=true;setBusy(true);onBusy(true);try{await confirmEbookUpload(path,kind);onChange(path);setFile(null);retryPath.current=null;onPending(false);if(input.current)input.current.value='';setMessage('Gambar dipulihkan dan diverifikasi. Simpan formulir untuk menerapkan.');}catch(e){setMessage(e instanceof Error?e.message:'Pemulihan gagal. File tidak dihapus.');}finally{lock.current=false;setBusy(false);onBusy(false);}}
 return <section className="em-image" aria-busy={busy} aria-label={kind==='covers'?'Cover e-book':'Banner e-book'}>
  <label>{kind==='covers'?'Pilih cover':'Pilih banner'}<input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled||busy} onChange={async e=>{
   const token=++selection.current,chosen=e.target.files?.[0];retryPath.current=null;setFile(null);onPending(!!chosen);setMessage('');if(!chosen)return;
   try{await validateTestimonialFile(chosen);if(selection.current===token)setFile(chosen);}catch(err){if(selection.current===token){onPending(false);if(input.current)input.current.value='';setMessage((err as Error).message);}}
  }}/></label><small>PNG, JPG, WebP · maksimal 5 MB. Preview belum tersimpan.</small>
  {(preview||saved)&&<img src={preview||saved} alt={preview?'Preview gambar sebelum upload':'Gambar yang dipilih untuk disimpan'} className={kind==='banners'?'em-banner-preview':'em-cover-preview'}/>}
  {file&&<div className="em-actions"><button type="button" className="secondary-button" disabled={disabled||busy} aria-busy={busy} onClick={()=>void upload()}>{busy?'Memproses...':'Upload gambar pilihan'}</button><button type="button" className="text-button" disabled={disabled||busy} onClick={()=>{selection.current++;setFile(null);onPending(false);if(input.current)input.current.value='';}}>Batal pilihan</button></div>}
  {value&&<button type="button" className="text-button" disabled={disabled||busy} onClick={()=>{onChange(null);setMessage('Gambar dilepas dari draft. File Storage tidak dihapus.');}}>Lepas gambar</button>}
  {recovery.some(r=>r.kind===kind)&&<details><summary>Catatan upload yang perlu ditinjau</summary><p>File mungkin belum tersimpan pada formulir. File tidak dihapus otomatis agar gambar bersama tetap aman.</p>{recovery.filter(r=>r.kind===kind).slice(-10).map(r=><div key={r.path}><small style={{overflowWrap:'anywhere'}}>{r.path}</small><button type="button" className="text-button" disabled={disabled||busy} onClick={()=>void recover(r.path)}>Verifikasi &amp; gunakan ulang</button></div>)}</details>}
  <p role="status" aria-live="polite" className="ui-activity">{busy?<><span className="ui-spinner" aria-hidden="true"/>Memproses gambar di Storage...</>:message}</p>
 </section>;
}
