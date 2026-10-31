'use client';
import {useCallback,useEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,ChevronLeft,ChevronRight,X,ZoomIn} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {readTestimonials,type Testimonial} from '@/lib/supabase/testimonials';
import {DialogKeyboard} from './dialog-keyboard';
import './testimonials.css';
export function TestimonialGallery(){
 const [rows,setRows]=useState<Testimonial[]>([]),[status,setStatus]=useState('loading'),[open,setOpen]=useState<Testimonial|null>(null),[index,setIndex]=useState(0);
 const track=useRef<HTMLDivElement>(null);
 const close=useCallback(()=>setOpen(null),[]);
 useEffect(()=>{let active=true;async function refresh(){try{const next=await readTestimonials(createClient());if(active){setRows(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);setStatus('ready');}}catch{if(active)setStatus('error');}}void refresh();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},30000);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 useEffect(()=>{setOpen(current=>current&&!rows.some(r=>r.id===current.id)?null:current);},[rows]);
 const pages=Array.from({length:Math.ceil(rows.length/3)},(_,page)=>rows.slice(page*3,page*3+3));
 const pageCount=pages.length;
 const currentPage=Math.min(index,Math.max(0,pageCount-1));
 const rowIds=rows.map(row=>row.id).join(',');
 useEffect(()=>{setIndex(0);track.current?.scrollTo({left:0,behavior:'instant'});},[rowIds]);
 const advance=(direction:number)=>{
  const el=track.current;if(!el)return;
  const next=Math.max(0,Math.min(pageCount-1,currentPage+direction));
  el.scrollTo({left:next*el.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 };
 return <section className="rp-showcase rp-testimonial-showcase" aria-labelledby="hero-testimonials-title"><div className="rp-showcase-heading"><span>TESTIMONI PELANGGAN</span><ZoomIn size={16}/></div><div className="rp-testimonial-intro"><h2 id="hero-testimonials-title">Apa Kata Pelanggan?</h2><p>Screenshot pengalaman pelanggan. Klik gambar untuk memperbesar.</p></div>
 {rows.length?<><div className="tg-track tg-paged-track" ref={track} onScroll={e=>{const el=e.currentTarget;if(el.clientWidth)setIndex(Math.round(el.scrollLeft/el.clientWidth));}} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();advance(e.key==='ArrowRight'?1:-1);}}} aria-label="Galeri screenshot testimoni" tabIndex={0}>{pages.map((page,pageIndex)=><div className="tg-page" key={page[0].id} style={{'--tg-columns':page.length} as CSSProperties} role="group" aria-label={'Halaman '+(pageIndex+1)+' dari '+pageCount}>{page.map((row,i)=><button className="tg-slide" key={row.id} onClick={()=>setOpen(row)} aria-label={'Perbesar testimoni '+(pageIndex*3+i+1)}><img src={row.url} alt={'Screenshot testimoni pelanggan '+(pageIndex*3+i+1)} loading={pageIndex===0?'eager':'lazy'} onError={e=>{e.currentTarget.alt='Screenshot belum dapat dimuat. Coba muat ulang halaman.';}}/></button>)}</div>)}</div>{pageCount>1&&<div className="tg-navigation"><button aria-label="Testimoni sebelumnya" onClick={()=>advance(-1)} disabled={currentPage===0}><ChevronLeft size={18}/></button><span aria-live="polite">{currentPage+1} / {pageCount}</span><button aria-label="Testimoni berikutnya" onClick={()=>advance(1)} disabled={currentPage>=pageCount-1}><ChevronRight size={18}/></button></div>}</>:<div className="tg-empty" role="status">{status==='loading'?'Memuat testimoni...':status==='error'?'Testimoni belum dapat dimuat. Silakan coba kembali.':'Testimoni pelanggan akan segera tersedia'}</div>}
 <a className="rp-testimonial-link" href="https://t.me/Tst_rakprem" target="_blank" rel="noopener noreferrer">Lihat Semua Testimoni<ArrowUpRight size={16}/></a>
 {open&&createPortal(<div className="tg-lightbox" onClick={close}><section role="dialog" aria-modal="true" aria-label="Screenshot testimoni diperbesar" onClick={e=>e.stopPropagation()}><DialogKeyboard onClose={close}/><button className="tg-close" onClick={close} aria-label="Tutup screenshot"><X size={22}/></button><img src={open.url} alt="Screenshot testimoni pelanggan diperbesar"/></section></div>,document.body)}
 </section>;
}
