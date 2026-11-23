'use client';

import {PublicText,PublicInput} from '@/components/public-copy';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Search, ShieldCheck, Headphones, Layers3 } from 'lucide-react';
import { ProductImage } from '@/components/product-image';
import {CatalogTabs,CatalogSearch} from '@/components/catalog-navigation';
import { Product, productSlug } from '@/lib/products';
import { useCatalogPreview } from '@/lib/supabase/use-catalog-preview';
import { useStoreSettings } from '@/lib/supabase/use-store-settings';
import './public-store.css';
import { TestimonialGallery } from '@/components/testimonial-gallery';
import './public-mobile.css';
import {PublicStoreFrame} from '@/components/public-store-frame';
import {PublicStoreHeader} from '@/components/public-store-header';
import {CatalogArtwork} from '@/components/catalog-artwork';

function WhatsAppIcon(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7L4 20l1.3-4.1A8 8 0 1 1 20 11.7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 8.3c-.4 0-.8.6-.8 1.2 0 1.7 3 4.7 4.8 4.8.6 0 1.3-.5 1.3-.9l-1.7-1-.7.6c-.8-.3-1.8-1.3-2.1-2.1l.5-.8L9.5 8.3H9Z" fill="currentColor"/></svg>}
function ProductCard({product,products}:{product:Product;products:Product[]}){
 const accents:Record<string,string>={blue:'107 151 219',green:'109 184 161',white:'178 192 218',cyan:'119 178 195',red:'208 113 130',lime:'112 179 139'};
 const accent=accents[product.color]??accents.blue;
 return <Link data-analytics-event="product_click" data-analytics-catalog="apps" data-analytics-product={product.id} href={'/produk/'+productSlug(product,products)} className="rp-card rp-card-3d rp-catalog-link" style={{'--card-accent':accent} as CSSProperties} aria-label={'Lihat paket '+product.name}><span className="rp-catalog-logo"><ProductImage product={product} loading="lazy"/></span><span className="rp-catalog-name">{product.name}</span></Link>;
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
 return <PublicStoreFrame>
  <a className="rp-skip" href="#katalog"><PublicText text="Langsung ke katalog"/></a>
  <PublicStoreHeader contact={contact}/>
  <main className="ui-route-enter">
   <div className="rp-shell"><CatalogArtwork kind="apps"/></div>

   <section id="katalog" className="rp-catalog rp-shell" aria-label="Katalog aplikasi premium">
    <div className="rp-controls"><CatalogTabs active="apps"/><CatalogSearch value={query} onChange={setQuery} placeholder="Cari aplikasi premium..."/><div className="rp-filters" aria-label="Filter kategori">{available.map(value=><button key={value} aria-pressed={category===value} className={category===value?'is-active':''} onClick={()=>setCategory(value)}>{value==='Semua produk'?<PublicText text="Semua produk"/>:value}</button>)}</div></div>
    {settingsError&&<p className="rp-notice" role="alert"><PublicText text="Pemesanan WhatsApp sementara belum tersedia. Silakan muat ulang halaman."/></p>}
    <p className="rp-results" role="status">{ready?<PublicText text="{count} produk ditemukan" values={{count:filtered.length}}/>:<PublicText text="Menyiapkan pilihan premium untukmu…"/>}</p>
    {catalog.state.status==='error'?<div className="rp-empty"><h3><PublicText text="Katalog belum dapat dimuat."/></h3><p><PublicText text="Periksa koneksi dan coba kembali."/></p><button className="rp-buy" onClick={catalog.retry}><PublicText text="Coba lagi"/></button></div>:!ready?<div className="rp-grid" aria-busy="true" aria-label="Memuat katalog">{[0,1,2,3].map(i=><div className="rp-skeleton" key={i}><div/><span/><span/></div>)}</div>:filtered.length?<div className="rp-grid">{filtered.map(product=><ProductCard key={product.id} product={product} products={products}/>)}</div>:<div className="rp-empty"><Search size={30}/><h3>{products.length?<PublicText text="Belum menemukan yang kamu cari?"/>:<PublicText text="Katalog sedang disiapkan."/>}</h3><p>{products.length?<PublicText text="Coba kata kunci lain atau lihat semua kategori."/>:<PublicText text="Silakan kembali beberapa saat lagi."/>}</p>{products.length>0&&<button className="rp-buy" onClick={()=>{setQuery('');setCategory('Semua produk');}}><PublicText text="Lihat semua produk"/></button>}</div>}
    <p className="rp-catalog-note"><PublicText text="Konfirmasi ketersediaan, detail layanan, dan ketentuan paket melalui WhatsApp sebelum melakukan pembayaran."/></p>
   </section>
   <div className="rp-after-catalog rp-shell"><TestimonialGallery/></div>
   <section id="keunggulan" className="rp-assurance rp-shell" aria-labelledby="assurance-title"><div className="rp-section-heading"><div><span className="rp-eyebrow"><PublicText text="KECIL LANGKAHNYA. BESAR BEDANYA."/></span><h2 id="assurance-title"><PublicText text="Lebih nyaman dari awal."/></h2></div></div><div className="rp-assurance-grid"><article><Layers3/><h3><PublicText text="Pilih sesuai kebutuhan"/></h3><p><PublicText text="Bandingkan durasi dan harga paket dalam satu tampilan yang sederhana."/></p></article><article><Headphones/><h3><PublicText text="Terhubung secara personal"/></h3><p><PublicText text="Pesan langsung melalui WhatsApp untuk mendiskusikan pilihan dan ketersediaan."/></p></article><article><ShieldCheck/><h3><PublicText text="Ketentuan yang jelas"/></h3><p><PublicText text="Tanyakan cakupan garansi, aktivasi, dan bantuan untuk paket pilihanmu sebelum membeli."/></p></article></div></section>
   <section className="rp-bottom rp-shell"><div className="rp-bottom-inner"><div><span className="rp-eyebrow">LET’S FIND YOUR NEXT UPGRADE</span><h2><PublicText text="Pilihan tepat dimulai"/><br/><PublicText text="dari percakapan sederhana."/></h2><p><PublicText text="Butuh bantuan memilih paket? Kami siap berdiskusi."/></p></div>{contact?<a href={contact} target="_blank" rel="noopener noreferrer" className="rp-order"><WhatsAppIcon/><PublicText text="Tanya via WhatsApp"/><ArrowUpRight size={16}/></a>:<a href="#katalog" className="rp-buy"><PublicText text="Lihat pilihan produk"/><ArrowRight size={16}/></a>}</div></section>
  </main>
  <footer className="rp-footer rp-shell"><div className="rp-footer-top"><div><Link href="/" className="rp-footer-brand" aria-label="Rakyat Premium, beranda"><svg className="store-footer-wordmark" viewBox="253 578 2165 347" role="img" aria-label="Rakyat Premium — digital store"><image href="/artwork/text-rakyatpremium.lossless.webp" width="2640" height="1485"/></svg></Link><p>Digital essentials. Thoughtfully selected.</p></div><nav aria-label="Navigasi footer"><a href="#katalog"><PublicText text="Katalog produk"/></a><a href="#keunggulan"><PublicText text="Informasi layanan"/></a></nav></div><div className="rp-footer-bottom"><span>© {new Date().getFullYear()} Rakyat Premium</span><span><PublicText text="Katalog digital independen."/></span></div></footer>
 </PublicStoreFrame>;
}

