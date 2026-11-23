'use client';

import {PublicText,PublicInput} from './public-copy';
import {useState} from 'react';
import Link from 'next/link';
import {filterEbooks,type PublicEbook,type PublicCategory,type PublicBanner} from '@/lib/ebook-public';
import {rupiah} from '@/lib/products';
import {EbookCover,EbookBanner} from './ebook-cover';
import {CatalogTabs,CatalogSearch} from './catalog-navigation';
import {CatalogArtwork} from './catalog-artwork';
export function EbookCatalog({books,categories,banner,linkSuffix=''}:{books:PublicEbook[];categories:PublicCategory[];banner:PublicBanner;linkSuffix?:string}){
 const [category,setCategory]=useState(''),[kind,setKind]=useState('all'),[query,setQuery]=useState('');
 const visible=filterEbooks(books,category,kind,query);
 return <main className="eb-shell eb-main ui-route-enter" id="ebook-catalog">
  <CatalogArtwork kind="ebooks"/>
  <div className="eb-browse"><CatalogTabs active="ebooks" ebookHref={'/ebook'+linkSuffix}/><CatalogSearch value={query} onChange={setQuery} placeholder="Cari e-book..."/></div>
  <section className="eb-controls" aria-label="Filter e-book"><label className="eb-category-filter"><PublicText text="Kategori"/><select value={category} onChange={e=>setCategory(e.target.value)}><option value=""><PublicText text="Semua kategori"/></option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="eb-type-filter" role="group" aria-label="Filter harga">{[['all','Semua'],['free','Gratis'],['paid','Berbayar']].map(([value,label])=><button key={value} aria-pressed={kind===value} onClick={()=>setKind(value)}>{label}</button>)}</div></section>
  <p className="eb-results" role="status" aria-live="polite"><PublicText text="{count} e-book ditemukan" values={{count:visible.length}}/></p>
  {visible.length?<div className="eb-grid">{visible.map(book=><Link data-analytics-event="product_click" data-analytics-catalog="ebooks" data-analytics-product={book.id} href={'/ebook/'+book.slug+linkSuffix} className="eb-card" key={book.id}><EbookCover url={book.coverUrl} title={book.title}/><div className="eb-card-content"><span className={'eb-label '+(book.isFree?'eb-free':'')}>{book.isFree?<PublicText text="GRATIS"/>:<PublicText text="BERBAYAR"/>}</span><h2>{book.title}</h2><p>{book.category}</p><strong className="eb-card-price">{book.isFree?<PublicText text="Gratis"/>:rupiah(book.price)}</strong></div></Link>)}</div>:<section className="eb-state"><h2>{books.length?<PublicText text="Tidak ada e-book yang sesuai filter."/>:<PublicText text="Katalog e-book sedang disiapkan."/>}</h2><p>{books.length?<PublicText text="Coba kategori atau jenis lainnya."/>:<PublicText text="Silakan kembali beberapa saat lagi."/>}</p>{books.length>0&&<button className="eb-button" onClick={()=>{setCategory('');setKind('all');setQuery('');}}><PublicText text="Reset filter"/></button>}</section>}
  {banner&&<EbookBanner url={banner.url} alt={banner.alt}/>}
 </main>;
}
