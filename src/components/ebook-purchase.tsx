'use client';
import {Download,MessageCircle,ArrowUpRight} from 'lucide-react';
import {useStoreSettings} from '@/lib/supabase/use-store-settings';
import {ebookDownloadLink,ebookWhatsAppLink,type PublicEbook} from '@/lib/ebook-public';
export function EbookPurchase({book,downloadUrl,preview=false}:{book:PublicEbook;downloadUrl:string|null;preview?:boolean}){
 if(preview)return <div className="eb-purchase"><button className="eb-button" disabled>{book.isFree?<Download size={18}/>:<MessageCircle size={18}/>} {book.isFree?'Download Gratis':'Beli via WhatsApp'}</button><p>Simulasi visual saja. Tidak ada file yang diunduh atau pesanan yang dikirim.</p></div>;
 return book.isFree?<FreeDownload book={book} url={downloadUrl}/>:<PaidPurchase book={book}/>;
}
function FreeDownload({book,url}:{book:PublicEbook;url:string|null}){
 const href=ebookDownloadLink(book,url);
 return <div className="eb-purchase">{href?<a className="eb-button" href={href} target="_blank" rel="noopener noreferrer"><Download size={18}/>Download Gratis<ArrowUpRight size={16}/></a>:<><button className="eb-button" disabled>Download belum tersedia</button><p>Link download belum tersedia. Silakan coba kembali nanti.</p></>}<p>Dokumen dibuka di tab baru melalui tautan penyedia.</p></div>;
}
export function PaidPurchase({book}:{book:PublicEbook}){
 const store=useStoreSettings(),href=store.ready&&!store.error?ebookWhatsAppLink(book,store.settings.number):'';
 return <div className="eb-purchase">{href?<a className="eb-button" href={href} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>Beli via WhatsApp<ArrowUpRight size={16}/></a>:<button className="eb-button" disabled>{store.error?'Pemesanan belum tersedia':'Menyiapkan WhatsApp…'}</button>}{store.error&&<p role="alert">Nomor toko belum dapat dibaca. Muat ulang halaman untuk mencoba kembali.</p>}<p>Pembayaran dan pengiriman file dilakukan manual oleh Admin melalui WhatsApp.</p></div>;
}
