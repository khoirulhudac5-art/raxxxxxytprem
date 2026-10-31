'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { Header } from './header';
import { createClient } from '@/lib/supabase/client';
import { readTestimonials,validateTestimonialFile,TESTIMONIAL_BUCKET,type Testimonial } from '@/lib/supabase/testimonials';
import './testimonials.css';
export function TestimonialManager(){
 const [rows,setRows]=useState<Testimonial[]>([]),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[ready,setReady]=useState(false),[pendingDelete,setPendingDelete]=useState<string|null>(null);
 const lock=useRef(false),input=useRef<HTMLInputElement>(null);
 const refresh=useCallback(async()=>{const next=await readTestimonials(createClient(),true);setRows(next);setReady(true);},[]);
 useEffect(()=>{void refresh().catch(e=>setMessage(e.message));},[refresh]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 async function action(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{await work();await refresh();}catch(e){setMessage(e instanceof Error?e.message:'Permintaan gagal. Muat ulang untuk memeriksa hasil.');}finally{lock.current=false;setBusy(false);}}
 async function upload(){if(!file)return;await action(async()=>{
  const ext=await validateTestimonialFile(file),client=createClient(),id=crypto.randomUUID(),path=`${id}.${ext}`;
  const uploaded=await client.storage.from(TESTIMONIAL_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
  if(uploaded.error)throw Error('Upload gagal. Periksa ukuran file, bucket, dan izin Admin.');
  const result=await client.from('testimonials').insert({id,storage_path:path,image_url:`storage://${TESTIMONIAL_BUCKET}/${path}`,sort_order:Math.max(0,...rows.map(r=>r.sort_order))+10,is_published:false});
  if(result.error){
   // A timeout may have committed: check the stable ID before considering cleanup.
   const check=await client.from('testimonials').select('id').eq('id',id).maybeSingle();
   if(check.error)throw Error(`Status simpan belum pasti. Muat ulang sebelum upload lagi. File: ${path}`);
   if(!check.data){const cleanup=await client.storage.from(TESTIMONIAL_BUCKET).remove([path]);throw Error(cleanup.error?`Pencatatan gagal. File perlu dibersihkan di bucket: ${path}`:'Pencatatan gagal; file upload sudah dibersihkan.');}
  }
  setFile(null);if(input.current)input.current.value='';setMessage('Upload berhasil sebagai draft. Klik Publikasikan agar tampil di hero.');
 });}
 async function publish(row:Testimonial){await action(async()=>{const result=await createClient().from('testimonials').update({is_published:!row.is_published}).eq('id',row.id).select('id').single();if(result.error)throw Error('Perubahan publikasi gagal.');setMessage(row.is_published?'Testimoni disembunyikan.':'Testimoni dipublikasikan.');});}
 async function remove(row:Testimonial){await action(async()=>{const client=createClient();const hide=await client.from('testimonials').update({is_published:false}).eq('id',row.id).select('id').single();if(hide.error)throw Error('Penghapusan dibatalkan: gagal menyembunyikan testimoni.');const storage=await client.storage.from(TESTIMONIAL_BUCKET).remove([row.storage_path]);if(storage.error)throw Error('Testimoni sudah disembunyikan; hapus file gagal. Coba Hapus lagi.');const deleted=await client.from('testimonials').delete().eq('id',row.id).select('id').single();if(deleted.error)throw Error('File dihapus, metadata belum terhapus. Muat ulang lalu coba Hapus lagi.');setPendingDelete(null);setMessage('Testimoni dan file berhasil dihapus.');});}
 async function move(index:number,delta:number){const next=[...rows];[next[index],next[index+delta]]=[next[index+delta],next[index]];await action(async()=>{const result=await createClient().rpc('reorder_testimonials',{ordered_ids:next.map(r=>r.id)});if(result.error)throw Error('Urutan gagal disimpan. Muat ulang dan coba lagi.');setMessage('Urutan berhasil disimpan.');});}
 return <><Header admin/><main className="container admin-main tm-manager"><Link href="/admin" className="back-link">← Kembali ke Admin produk</Link><h1>Kelola Testimoni</h1><p>Upload screenshot asli. Periksa izin pemilik dan samarkan informasi pribadi sebelum publikasi.</p><section className="tm-upload"><label>Screenshot (JPG, PNG, WebP · maksimal 5 MB)<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e=>{const chosen=e.target.files?.[0];setFile(null);if(!chosen)return;try{await validateTestimonialFile(chosen);setFile(chosen);setMessage('');}catch(err){e.target.value='';setMessage((err as Error).message);}}}/></label>{preview&&<img src={preview} className="tm-preview" alt="Preview screenshot sebelum upload"/>}<button className="primary-button" disabled={!file||busy||!ready} onClick={()=>void upload()}>Upload sebagai draft</button></section><p role="status" aria-live="polite">{message}</p><button className="secondary-button" disabled={busy} onClick={()=>void action(async()=>{await refresh();setMessage('Daftar dimuat ulang.');})}>Muat ulang</button><div className="tm-list">{ready&&!rows.length&&<p>Belum ada testimoni.</p>}{rows.map((row,i)=><article className="tm-row" key={row.id}>{row.url?<img src={row.url} alt={`Screenshot testimoni ${i+1}`} onError={e=>{e.currentTarget.alt='Preview tidak tersedia; muat ulang daftar.';}}/>:<span>Preview tidak tersedia</span>}<div><strong>Testimoni {i+1}</strong><p>{row.is_published?'Dipublikasikan':'Draft'}</p><div className="tm-actions"><button disabled={busy||i===0} onClick={()=>void move(i,-1)}>Naik</button><button disabled={busy||i===rows.length-1} onClick={()=>void move(i,1)}>Turun</button><button disabled={busy} onClick={()=>void publish(row)}>{row.is_published?'Sembunyikan':'Publikasikan'}</button>{pendingDelete===row.id?<><span>Hapus screenshot ini?</span><button disabled={busy} onClick={()=>void remove(row)}>Ya, hapus</button><button disabled={busy} onClick={()=>setPendingDelete(null)}>Batal</button></>:<button disabled={busy} onClick={()=>setPendingDelete(row.id)}>Hapus</button>}</div></div></article>)}</div></main></>;
}
