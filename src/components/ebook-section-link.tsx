'use client';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
export function EbookSectionLink({current=false}:{current?:boolean}){
 const search=useSearchParams();
 const preview=process.env.NODE_ENV==='development'&&search.get('preview')==='local-ebooks';
 return <Link href={'/ebook'+(preview?'?preview=local-ebooks':'')} aria-current={current?'page':undefined}>E-Book</Link>;
}
