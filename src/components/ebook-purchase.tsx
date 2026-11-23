'use client';

import {PublicText,PublicInput} from './public-copy';
import {Download,MessageCircle,ArrowUpRight} from 'lucide-react';
import {useStoreSettings} from '@/lib/supabase/use-store-settings';
import {ebookDownloadLink,ebookWhatsAppLink,type PublicEbook} from '@/lib/ebook-public';
export function EbookPurchase({book,downloadUrl,preview=false}:{book:PublicEbook;downloadUrl:string|null;preview?:boolean}){
 if(preview)return <div className="eb-purchase"><button className="eb-button" disabled>{book.isFree?<Download size={18}/>:<MessageCircle size={18}/>} {book.isFree?<PublicText text="Download Gratis"/>:<PublicText text="Beli via WhatsApp"/>}</button><p><PublicText text="Simulasi visual saja. Tidak ada file yang diunduh atau pesanan yang dikirim."/></p></div>;
 return book.isFree?<FreeDownload book={book} url={downloadUrl}/>:<PaidPurchase book={book}/>;
}
function FreeDownload({book,url}:{book:PublicEbook;url:string|null}){
 const href=ebookDownloadLink(book,url);
 return <div className="eb-purchase">{href?<a className="eb-button" href={href} target="_blank" rel="noopener noreferrer"><Download size={18}/><PublicText text="Download Gratis"/><ArrowUpRight size={16}/></a>:<><button className="eb-button" disabled><PublicText text="Download belum tersedia"/></button><p><PublicText text="Link download belum tersedia. Silakan coba kembali nanti."/></p></>}<p><PublicText text="Dokumen dibuka di tab baru melalui tautan penyedia."/></p></div>;
}
export function PaidPurchase({book}:{book:PublicEbook}){
 const store=useStoreSettings(),href=store.ready&&!store.error?ebookWhatsAppLink(book,store.settings.number):'';
 return <div className="eb-purchase">{href?<a data-analytics-event="purchase_whatsapp_click" data-analytics-catalog="ebooks" data-analytics-product={book.id} className="eb-button" href={href} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/><PublicText text="Beli via WhatsApp"/><ArrowUpRight size={16}/></a>:<button className="eb-button" disabled>{store.error?<PublicText text="Pemesanan belum tersedia"/>:<PublicText text="Menyiapkan WhatsApp…"/>}</button>}{store.error&&<p role="alert"><PublicText text="Nomor toko belum dapat dibaca. Muat ulang halaman untuk mencoba kembali."/></p>}<p><PublicText text="Pembayaran dan pengiriman file dilakukan manual oleh Admin melalui WhatsApp."/></p></div>;
}
