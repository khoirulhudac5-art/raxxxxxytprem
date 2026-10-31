'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {validateTestimonialFile} from '@/lib/supabase/testimonials';
import './product-image-upload.css';
export function ProductImageUpload({value,onChange,onBusyChange}:{value:string;onChange:(url:string)=>void;onBusyChange:(busy:boolean)=>void}){
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const input=useRef<HTMLInputElement>(null),lock=useRef(false);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 async function upload(){if(!file||lock.current)return;lock.current=true;setBusy(true);onBusyChange(true);setMessage('');try{
  const ext=await validateTestimonialFile(file),client=createClient();
  const {data:user,error:authError}=await client.auth.getUser();
  if(authError||!user.user)throw Error('Sesi berakhir. Login kembali sebelum upload.');
  const admin=await client.rpc('is_admin');if(admin.error||admin.data!==true)throw Error('Akses Admin diperlukan.');
  const path=crypto.randomUUID()+'.'+ext;
  const uploaded=await client.storage.from('product-images').upload(path,file,{contentType:file.type,upsert:false});
  if(uploaded.error)throw Error('Upload gagal. Periksa bucket product-images, izin Admin, dan batas 5 MB.');
  const {data}=client.storage.from('product-images').getPublicUrl(path);
  onChange(data.publicUrl);setFile(null);if(input.current)input.current.value='';
  setMessage('Upload berhasil. Klik Simpan produk untuk menyimpan gambar pada produk.');
 }catch(e){setMessage(e instanceof Error?e.message:'Upload gagal.');}finally{lock.current=false;setBusy(false);onBusyChange(false);}}
 return <section className="product-upload" aria-label="Upload gambar produk"><label className="secondary-button">Pilih Gambar<input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async e=>{const chosen=e.target.files?.[0];setFile(null);if(!chosen)return;try{await validateTestimonialFile(chosen);setFile(chosen);setMessage('Preview belum diunggah.');}catch(err){e.target.value='';setMessage((err as Error).message);}}}/></label><p>PNG, JPG, WebP · maksimal 5 MB. Logo PNG transparan 1024 × 1024 px disarankan.</p>{preview&&<img className="product-upload-preview" src={preview} alt="Preview gambar yang dipilih sebelum upload"/>}{file&&<div className="product-upload-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>void upload()}>{busy?'Mengunggah...':'Upload gambar pilihan'}</button><button type="button" className="text-button" disabled={busy} onClick={()=>{setFile(null);if(input.current)input.current.value='';}}>Batal pilihan</button></div>}{value&&<button type="button" className="text-button danger" disabled={busy} onClick={()=>{onChange('');setFile(null);setMessage('Gambar dilepas dari draft. Klik Simpan produk untuk menerapkan. File Storage tetap disimpan.');}}>Hapus gambar dari produk</button>}<p role="status" aria-live="polite">{message}</p></section>;
}
