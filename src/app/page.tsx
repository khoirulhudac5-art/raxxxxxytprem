'use client';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Search, Check, ShieldCheck, Headphones, Layers3, X } from 'lucide-react';
import { ProductImage } from '@/components/product-image';
import { Product, rupiah } from '@/lib/products';
import { useCatalogPreview } from '@/lib/supabase/use-catalog-preview';
import { useStoreSettings } from '@/lib/supabase/use-store-settings';
import { WhatsAppSettings, whatsAppLink } from '@/lib/whatsapp';
import './public-store.css';
import { TestimonialGallery } from '@/components/testimonial-gallery';

function WhatsAppIcon(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7L4 20l1.3-4.1A8 8 0 1 1 20 11.7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 8.3c-.4 0-.8.6-.8 1.2 0 1.7 3 4.7 4.8 4.8.6 0 1.3-.5 1.3-.9l-1.7-1-.7.6c-.8-.3-1.8-1.3-2.1-2.1l.5-.8L9.5 8.3H9Z" fill="currentColor"/></svg>}
function ProductCard({product,settings,settingsReady}:{product:Product;settings:WhatsAppSettings;settingsReady:boolean}){
 const [selected,setSelected]=useState(0);
 const surface=useRef<HTMLElement>(null);
 const frame=useRef<number|null>(null);
 const tiltAllowed=useRef(false);
 useEffect(()=>{
  const media=window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const update=()=>{tiltAllowed.current=media.matches;resetTilt();};
  update();media.addEventListener('change',update);
  return ()=>{media.removeEventListener('change',update);if(frame.current!==null)cancelAnimationFrame(frame.current);};
 },[]);
 function resetTilt(){
  if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}
  surface.current?.style.setProperty('--tilt-x','0deg');
  surface.current?.style.setProperty('--tilt-y','0deg');
 }
 function moveTilt(event:PointerEvent<HTMLDivElement>){
  if(!tiltAllowed.current||event.pointerType!=='mouse')return;
  const bounds=event.currentTarget.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return;
  const clamp=(value:number)=>Math.max(-1,Math.min(1,value));
  const x=-clamp((event.clientY-bounds.top)/bounds.height*2-1)*5;
  const y=clamp((event.clientX-bounds.left)/bounds.width*2-1)*5;
  if(frame.current!==null)cancelAnimationFrame(frame.current);
  frame.current=requestAnimationFrame(()=>{
   surface.current?.style.setProperty('--tilt-x',x.toFixed(2)+'deg');
   surface.current?.style.setProperty('--tilt-y',y.toFixed(2)+'deg');frame.current=null;
  });
 }
 const accents:Record<string,string>={chatgpt:'109 184 161',capcut:'178 192 218',canva:'114 152 221',google:'125 155 216',youtube:'208 113 130',spotify:'112 179 139',zoom:'107 151 219'};
 const colors:Record<string,string>={green:'109 184 161',white:'178 192 218',cyan:'119 178 195',red:'208 113 130',lime:'112 179 139',blue:'107 151 219'};
 const accent=accents[product.id]??colors[product.color]??'125 155 216';
 const plan=product.plans[selected]??product.plans[0];
 const orderLink=settingsReady?whatsAppLink(settings,product,plan):'';
 return <div className="rp-tilt-slot" onPointerMove={moveTilt} onPointerLeave={resetTilt} onPointerCancel={resetTilt} onBlur={resetTilt} style={{'--card-accent':accent} as CSSProperties}><article ref={surface} className="rp-card rp-card-3d">
  <div className="rp-card-topline"><span className="rp-category">{product.category}</span>{product.badge&&<span className="rp-badge">{product.badge}</span>}</div><div className="rp-product-visual"><span className="rp-image-pedestal" aria-hidden="true"/><ProductImage product={product}/></div>
  <div className="rp-card-body"><h3>{product.name}</h3><p className="rp-description">{product.description}</p>
   <fieldset className="rp-plans"><legend>Pilih durasi</legend>{product.plans.map((item,index)=><label className={`rp-plan ${selected===index?'is-selected':''}`} key={`${index}-${item.duration}`}><input type="radio" name={`plan-${product.id}`} checked={selected===index} onChange={()=>setSelected(index)}/><span className="rp-radio" aria-hidden="true">{selected===index&&<Check size={10}/>}</span><span>{item.duration}</span><strong>{rupiah(item.price)}</strong></label>)}</fieldset>
   <div className="rp-card-price"><span>Total pilihanmu</span><strong>{rupiah(plan.price)}</strong></div>
   {orderLink?<a className="rp-order" href={orderLink} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/>Pesan via WhatsApp<ArrowUpRight size={15}/></a>:<button className="rp-order" disabled><WhatsAppIcon/>Pemesanan belum tersedia</button>}
  </div>
 </article></div>;
}
export default function Home(){
 const {settings,ready:settingsReady,error:settingsError}=useStoreSettings();
 const catalog=useCatalogPreview(true);
 const products=catalog.state.products;
 const ready=['ready','empty','error'].includes(catalog.state.status);
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('Semua produk');
 const available=['Semua produk',...new Set(products.map(product=>product.category))];
 const term=query.trim().toLocaleLowerCase('id');
 const filtered=products.filter(product=>(category==='Semua produk'||product.category===category)&&`${product.name} ${product.description} ${product.category}`.toLocaleLowerCase('id').includes(term));
 const contact=settingsReady&&settings.number?`https://wa.me/${settings.number}`:'';
 return <div className="rp-store">
  <a className="rp-skip" href="#katalog">Langsung ke katalog</a>
  <header className="rp-header"><div className="rp-shell rp-header-inner"><Link href="/" className="rp-brand" aria-label="Rakyat Premium, beranda"><Image src="/logo.png" width={40} height={40} alt="" priority/><span>rakyat<span>premium</span><small>DIGITAL STORE</small></span></Link><nav aria-label="Navigasi utama"><a href="#katalog">Katalog</a><a href="#keunggulan" className="rp-nav-detail">Kenapa kami</a><a className="rp-testimonials" href="https://t.me/Tst_rakprem" target="_blank" rel="noopener noreferrer" aria-label="Testimoni Pembeli di Telegram (tab baru)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m21 3-4 18-6-6-4 3 1-7 13-8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="m8 11 13-8-10 12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg><span>Testimoni Pembeli</span></a>{contact&&<a className="rp-contact" href={contact} target="_blank" rel="noopener noreferrer"><WhatsAppIcon/><span>Hubungi kami</span></a>}</nav></div></header>
  <main>
   <section className="rp-hero rp-shell" aria-labelledby="hero-title"><div className="rp-hero-copy"><span className="rp-eyebrow"><span className="rp-dot"/> YOUR EVERYDAY DIGITAL UPGRADE</span><h1 id="hero-title">Lebih premium.<br/><span>Lebih banyak<br className="rp-desktop-break"/> kemungkinan.</span></h1><p>Pilihan digital untuk kerja, karya, dan hiburan. Temukan produk favoritmu, pilih paketnya, dan pesan dengan mudah.</p><div className="rp-hero-actions"><a className="rp-buy" href="#katalog">Jelajahi produk<ArrowRight size={17}/></a><a className="rp-subtle-link" href="#keunggulan">Kenali Rakyat Premium<ArrowUpRight size={14}/></a></div><div className="rp-hero-caption"><span><Check size={13}/>Pilihan paket fleksibel</span><span><Check size={13}/>Pemesanan personal</span></div></div>
    <TestimonialGallery/>
   </section>
   <div className="rp-trust-strip"><div className="rp-shell"><span><Layers3 size={17}/>Satu katalog, beragam kebutuhan</span><span><ShieldCheck size={17}/>Detail paket yang transparan</span><span><Headphones size={17}/>Komunikasi langsung via WhatsApp</span></div></div>
   <section id="katalog" className="rp-catalog rp-shell" aria-labelledby="catalog-title"><div className="rp-section-heading"><div><span className="rp-eyebrow">PILIHAN UNTUK KESEHARIANMU</span><h2 id="catalog-title">Temukan premium versimu.</h2><p>Mulai dari yang kamu butuhkan.</p></div><span className="rp-count">{ready?`${products.length} produk`:'Memuat produk'}</span></div>
    <div className="rp-controls"><div className="rp-search"><Search size={19}/><input aria-label="Cari produk" placeholder="Cari produk, kategori, atau kebutuhanmu…" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button aria-label="Hapus pencarian" onClick={()=>setQuery('')}><X size={16}/></button>}</div><div className="rp-filters" aria-label="Filter kategori">{available.map(value=><button key={value} aria-pressed={category===value} className={category===value?'is-active':''} onClick={()=>setCategory(value)}>{value}</button>)}</div></div>
    {settingsError&&<p className="rp-notice" role="alert">Pemesanan WhatsApp sementara belum tersedia. Silakan muat ulang halaman.</p>}
    <p className="rp-results" role="status">{ready?`${filtered.length} produk ditemukan`:'Menyiapkan pilihan premium untukmu…'}</p>
    {catalog.state.status==='error'?<div className="rp-empty"><h3>Katalog belum dapat dimuat.</h3><p>Periksa koneksi dan coba kembali.</p><button className="rp-buy" onClick={catalog.retry}>Coba lagi</button></div>:!ready?<div className="rp-grid" aria-busy="true" aria-label="Memuat katalog">{[0,1,2,3].map(i=><div className="rp-skeleton" key={i}><div/><span/><span/></div>)}</div>:filtered.length?<div className="rp-grid">{filtered.map(product=><ProductCard key={JSON.stringify(product)} product={product} settings={settings} settingsReady={settingsReady}/>)}</div>:<div className="rp-empty"><Search size={30}/><h3>{products.length?'Belum menemukan yang kamu cari?':'Katalog sedang disiapkan.'}</h3><p>{products.length?'Coba kata kunci lain atau lihat semua kategori.':'Silakan kembali beberapa saat lagi.'}</p>{products.length>0&&<button className="rp-buy" onClick={()=>{setQuery('');setCategory('Semua produk');}}>Lihat semua produk</button>}</div>}
    <p className="rp-catalog-note">Konfirmasi ketersediaan, detail layanan, dan ketentuan paket melalui WhatsApp sebelum melakukan pembayaran.</p>
   </section>
   <section id="keunggulan" className="rp-assurance rp-shell" aria-labelledby="assurance-title"><div className="rp-section-heading"><div><span className="rp-eyebrow">KECIL LANGKAHNYA. BESAR BEDANYA.</span><h2 id="assurance-title">Lebih nyaman dari awal.</h2></div></div><div className="rp-assurance-grid"><article><Layers3/><h3>Pilih sesuai kebutuhan</h3><p>Bandingkan durasi dan harga paket dalam satu tampilan yang sederhana.</p></article><article><Headphones/><h3>Terhubung secara personal</h3><p>Pesan langsung melalui WhatsApp untuk mendiskusikan pilihan dan ketersediaan.</p></article><article><ShieldCheck/><h3>Ketentuan yang jelas</h3><p>Tanyakan cakupan garansi, aktivasi, dan bantuan untuk paket pilihanmu sebelum membeli.</p></article></div></section>
   <section className="rp-bottom rp-shell"><div className="rp-bottom-inner"><div><span className="rp-eyebrow">LET’S FIND YOUR NEXT UPGRADE</span><h2>Pilihan tepat dimulai<br/>dari percakapan sederhana.</h2><p>Butuh bantuan memilih paket? Kami siap berdiskusi.</p></div>{contact?<a href={contact} target="_blank" rel="noopener noreferrer" className="rp-order"><WhatsAppIcon/>Tanya via WhatsApp<ArrowUpRight size={16}/></a>:<a href="#katalog" className="rp-buy">Lihat pilihan produk<ArrowRight size={16}/></a>}</div></section>
  </main>
  <footer className="rp-footer rp-shell"><div className="rp-footer-top"><div><Link href="/" className="rp-footer-brand">rakyat<span>premium</span></Link><p>Digital essentials. Thoughtfully selected.</p></div><nav aria-label="Navigasi footer"><a href="#katalog">Katalog produk</a><a href="#keunggulan">Informasi layanan</a><Link href="/admin">Admin<ArrowUpRight size={13}/></Link></nav></div><div className="rp-footer-bottom"><span>© {new Date().getFullYear()} Rakyat Premium</span><span>Katalog digital independen.</span></div></footer>
 </div>;
}

