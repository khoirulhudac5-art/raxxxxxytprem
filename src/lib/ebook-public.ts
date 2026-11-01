import {validFreeDownload} from './ebooks';
import {validWhatsAppNumber} from './whatsapp';
import {rupiah} from './products';
export type PublicEbook={id:string;slug:string;title:string;description:string;categoryId:string;category:string;coverUrl:string|null;isFree:boolean;price:number};
export type PublicCategory={id:string;name:string};
export type PublicBanner={url:string;alt:string}|null;
export type EbookDetailData={book:PublicEbook;downloadUrl:string|null};
export function filterEbooks(books:PublicEbook[],category:string,kind:string,query=''){const term=query.trim().toLocaleLowerCase('id');return books.filter(b=>(!category||b.categoryId===category)&&(kind==='all'||(kind==='free'?b.isFree:!b.isFree))&&`${b.title} ${b.category} ${b.description}`.toLocaleLowerCase('id').includes(term));}
export function ebookDownloadLink(book:PublicEbook,url:string|null){return book.isFree&&url&&validFreeDownload(url)?url:'';}
export function ebookWhatsAppLink(book:PublicEbook,number:string){
 if(book.isFree||!validWhatsAppNumber(number)||!Number.isSafeInteger(book.price)||book.price<1)return '';
 const message=`Halo Rakyat Premium! Saya ingin membeli e-book:\nJudul: ${book.title}\nHarga: ${rupiah(book.price)}\nMohon informasi pembayaran dan pengiriman file. Terima kasih.`;
 return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
