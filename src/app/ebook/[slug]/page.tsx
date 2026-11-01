import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {readPublicEbook} from '@/lib/supabase/ebook-public.server';
import {EbookCover} from '@/components/ebook-cover';
import {EbookPurchase} from '@/components/ebook-purchase';
import {rupiah} from '@/lib/products';
import {headers} from 'next/headers';
import {readLocalEbookPreview} from '@/lib/ebook-local-preview.server';
import {EbookPreviewNotice} from '@/components/ebook-preview-notice';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 const {slug}=await params,search=await searchParams;
 const preview=process.env.NODE_ENV==='development'?await readLocalEbookPreview(search?.preview,(await headers()).get('host')):null;
 const data=preview?{book:preview.books.find(b=>b.slug===slug),downloadUrl:null}:await readPublicEbook(slug);if(!data?.book)notFound();
 const {book,downloadUrl}=data;
 return <main className="eb-shell eb-main">{preview&&<EbookPreviewNotice/>}<Link href={'/ebook'+(preview?.suffix??'')} className="eb-back"><ArrowLeft size={16}/>Kembali ke katalog e-book</Link><article className="eb-detail"><div className="eb-detail-visual"><EbookCover url={book.coverUrl} title={book.title}/></div><div className="eb-detail-info"><span className="eb-eyebrow">{book.category}</span><h1>{book.title}</h1><span className={'eb-label '+(book.isFree?'eb-free':'')}>{book.isFree?'GRATIS':'BERBAYAR'}</span>{!book.isFree&&<p className="eb-detail-price">{rupiah(book.price)}</p>}<div className="eb-description">{(book.description.trim()||'Deskripsi e-book belum tersedia.').split(/\n\s*\n/).map((paragraph,index)=><p key={index}>{paragraph.trim()}</p>)}</div><EbookPurchase book={book} downloadUrl={book.isFree?downloadUrl:null} preview={!!preview}/></div></article></main>;
}
