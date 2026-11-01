'use client';
import {useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {ArrowLeft,ArrowUpRight,Check,MessageCircle} from 'lucide-react';
import {ProductImage} from './product-image';
import {DetailSkeleton} from './detail-skeleton';
import {type Product,rupiah,isPlanAvailable,availablePlanIndex,productSlug} from '@/lib/products';
import {useCatalogPreview} from '@/lib/supabase/use-catalog-preview';
import {useStoreSettings} from '@/lib/supabase/use-store-settings';
import {whatsAppLink,type WhatsAppSettings} from '@/lib/whatsapp';
import './product-detail.css';
export function ProductPackages({product,settings,settingsReady}:{product:Product;settings:WhatsAppSettings;settingsReady:boolean}){
 const [selected,setSelected]=useState(0);
 const effective=availablePlanIndex(product.plans,selected),plan=product.plans[effective];
 const order=plan&&settingsReady?whatsAppLink(settings,product,plan):'';
 return <><fieldset className="pd-packages"><legend>Pilih paket</legend>{product.plans.map((item,index)=><label key={index} className={`pd-package ${effective===index?'selected':''} ${!isPlanAvailable(item)?'sold-out':''}`}><input type="radio" name={'package-'+product.id} value={index} checked={effective===index} disabled={!isPlanAvailable(item)} onChange={()=>{if(isPlanAvailable(item))setSelected(index);}}/><span className="pd-radio" aria-hidden="true">{effective===index&&<Check size={11}/>}</span><span className="pd-duration">{item.duration}</span><strong>{rupiah(item.price)}</strong>{!isPlanAvailable(item)&&<small>Habis</small>}</label>)}</fieldset><div className="pd-purchase"><div><span>Total harga</span><strong aria-live="polite">{plan?rupiah(plan.price):'-'}</strong></div>{order?<a href={order} target="_blank" rel="noopener noreferrer" className="pd-order"><MessageCircle size={18}/>Pesan via WhatsApp<ArrowUpRight size={16}/></a>:<button className="pd-order" disabled>{effective<0?'Stok Habis':'Pemesanan belum tersedia'}</button>}</div><p className="pd-note">Konfirmasi ketersediaan dan ketentuan paket melalui WhatsApp sebelum pembayaran.</p></>;
}
export function ProductDetail({slug}:{slug:string}){
 const catalog=useCatalogPreview(true),store=useStoreSettings();
 const products=catalog.state.products;
 const product=products.find(p=>productSlug(p,products)===slug);
 const loading=['idle','loading'].includes(catalog.state.status);
 return <div className="pd-page"><header className="pd-header"><Link href="/" className="pd-brand"><Image src="/logo.png" alt="" width={34} height={34}/><span>rakyat<strong>premium</strong></span></Link><nav className="pd-catalog-nav" aria-label="Navigasi katalog"><Link href="/#katalog" className="pd-back" aria-current="page">Aplikasi</Link><Link href="/ebook" className="pd-back">E-Book</Link></nav></header><main className="pd-main"><Link href="/#katalog" className="pd-back"><ArrowLeft size={16}/>Kembali ke katalog</Link>{loading?<DetailSkeleton kind="app"/>:catalog.state.status==='error'?<section className="pd-state" role="alert"><h1>Produk belum dapat dimuat</h1><p>Periksa koneksi lalu coba kembali.</p><button className="pd-order" onClick={catalog.retry}>Coba lagi</button></section>:!product?<section className="pd-state"><h1>Produk tidak ditemukan</h1><p>Produk mungkin telah dihapus atau namanya berubah.</p><Link className="pd-order" href="/#katalog">Lihat katalog</Link></section>:<article className="pd-product"><div className="pd-visual"><ProductImage product={product}/></div><div className="pd-content"><span className="pd-category">{product.category}</span><h1>{product.name}</h1><p className="pd-description">{product.description}</p>{store.error&&<p className="pd-note" role="alert">Pengaturan WhatsApp belum dapat dibaca. Muat ulang halaman untuk mencoba kembali.</p>}<ProductPackages key={product.id} product={product} settings={store.settings} settingsReady={store.ready}/></div></article>}</main><footer className="pd-footer">Rakyat Premium · Katalog digital independen</footer></div>;
}
